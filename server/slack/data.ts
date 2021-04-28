import * as _ from 'lodash'
import {WebClient, WebAPICallResult} from '@slack/web-api'

import {IntegrationDisabledError} from '../errors'
import {User} from '../../types'

const {
  SLACK_KEY,
  SLACK_CACHE_EXPIRATION_MS: SLACK_CACHE_EXPIRATION_MS_STR = 1000 * 60 * 5, // 5 mins
  NODE_ENV,
} = process.env

const CACHE_EXPIRATION_MS = +SLACK_CACHE_EXPIRATION_MS_STR
const CACHED_CHANNEL_KEYS = ['id', 'name', 'num_members'] as const

export const ENABLED = !!SLACK_KEY

if (!ENABLED && NODE_ENV != 'test') console.log('No SLACK_KEY. Slack integration disabled')
else console.log('Found SLACK_KEY. Slack integration enabled.')

const webClient = new WebClient(SLACK_KEY)

function log(...messages: any[]) {
  console.log(`[${new Date().toLocaleString('en-US')}]`, ...messages)
}

type ID = string

interface SlackUser extends User {
  id: ID
  name: string
  imgUrl: string
}

interface Channel {
  id: ID
  name: string
  num_members: number
}

interface ConversationsListResult extends WebAPICallResult {
  channels: Channel[]
}

interface ConversationsMembersResult extends WebAPICallResult {
  members: ID[]
}

interface UsersProfileGetResult extends WebAPICallResult {
  profile: {
    real_name?: string
    real_name_normalized?: string
    display_name?: string
    display_name_normalized?: string
    image_512: string
  }
}

export interface Cache {
  channelsList?: {
    date: number // Date.now()
    channelsById: {[id: string]: Channel}
    channelsByName: {[name: string]: ID}
  }
  channelsMembers: Record<string, {
    date: number
    members: ID[]
  }>
  users?: Record<string, SlackUser & {date: number}>
}

export const cache: Cache = {channelsMembers: {}}

export function clearCache() {
  delete cache.channelsList
  cache.channelsMembers = {}
  delete cache.users
}

function getAllPaginatedData<GenericData, SlackAPIResponse extends WebAPICallResult>(
  fn: (cursor?: string) => Promise<SlackAPIResponse>,
  getter: (response: SlackAPIResponse) => GenericData[],
  partialData: GenericData[],
  cursor?: string
): Promise<GenericData[]> {
  return fn(cursor).then((res: SlackAPIResponse) => {
    const updatedPartialData = [...partialData, ...getter(res)]
    const updatedCursor = res?.response_metadata?.next_cursor

    if (!updatedCursor) return updatedPartialData
    return getAllPaginatedData(fn, getter, updatedPartialData, updatedCursor)
  })
}

function getAllChannels(): Promise<ConversationsListResult['channels']> {
  return getAllPaginatedData(
    // TODO: figure out a better way to type this without having to typecast, even though
    // typecasting is the official recommendation: https://slack.dev/node-slack-sdk/typescript
    cursor => webClient.conversations.list({cursor, limit: 200, exclude_archived: true}) as Promise<ConversationsListResult>,
    (res: ConversationsListResult) => _.get(res, 'channels'),
    [],
  )
}

function getAllMembersInChannel(channelId: string): Promise<ConversationsMembersResult['members']> {
  return getAllPaginatedData(
    cursor => webClient.conversations.members({channel: channelId, cursor, limit: 200}) as Promise<ConversationsMembersResult>,
    (res: ConversationsMembersResult) => _.get(res, 'members'),
    [],
  )
}

function getChannelsByKey(channels: Channel[], key: string) {
  return _.mapValues(_.groupBy(channels, key) as Record<string, [typeof channels[number]]>, arr => arr[0])
}

function getUserById(userId: string): Promise<SlackUser> {
  const maybeCachedUser = cache?.users?.[userId]
  if (maybeCachedUser) return Promise.resolve(maybeCachedUser)

  const apiPromise = webClient.users.profile.get({user: userId}) as Promise<UsersProfileGetResult>
  return apiPromise.then((response: UsersProfileGetResult) => {
    const {profile} = response
    const user: SlackUser = {
      id: userId,
      name: profile.real_name_normalized || profile.display_name_normalized || profile.real_name || profile.display_name || '',
      imgUrl: profile.image_512,
    }
    _.set(cache, `users.${userId}`, {date: Date.now(), ...user})
    return user
  })
}

export function getSlackChannels(): Promise<Cache['channelsList']> {
  if (!ENABLED) return Promise.reject(new IntegrationDisabledError('Slack integration is disabled'))

  const cacheDate = cache?.channelsList?.date
  if (cacheDate && cacheDate + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.channelsList)
  const startTime = Date.now()
  return getAllChannels()
    .then(channels => {
      const slimmedChannels = channels.map(channel => _.pick(channel, CACHED_CHANNEL_KEYS))
      const channelsList = {
        date: startTime,
        channelsById: getChannelsByKey(slimmedChannels, 'id'),
        channelsByName: _.mapValues(getChannelsByKey(slimmedChannels, 'name'), channel => channel.id),
      }

      cache.channelsList = channelsList

      log(`Slack channels cache warmed with ${channels.length} channels in ${Date.now() - startTime}ms`)
      return channelsList
    })
}

export function getSlackMembersByChannelId(channelId: string): Promise<SlackUser[]> {
  if (!ENABLED) return Promise.reject(new IntegrationDisabledError('Slack integration is disabled'))
  
  return getAllMembersInChannel(channelId)
    .then(userIds => Promise.all(userIds.map(userId => getUserById(userId))))
    .then(users => users)
}
