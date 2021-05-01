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

interface APIChannel {
  id: ID
  name: string
  num_members: number
}

interface Channel extends Omit<APIChannel, 'num_members'> {
  memberCount: APIChannel['num_members']
}

interface ConversationsListResult extends WebAPICallResult {
  channels: APIChannel[]
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
  users?: Record<string, {date: number, profile: SlackUser}>
}

export const cache: Cache = {channelsMembers: {}}

export function clearCache() {
  delete cache.channelsList
  cache.channelsMembers = {}
  delete cache.users
}

/*
 * Recursively fetches all paginated data.
 * Doesn't cache results, since we'll store a normalized version of the data downstream
 */
function fetchAllPaginatedData<GenericData, SlackAPIResponse extends WebAPICallResult>(
  fn: (cursor?: string) => Promise<SlackAPIResponse>,
  getter: (response: SlackAPIResponse) => GenericData[],
  partialData: GenericData[] = [],
  cursor?: string
): Promise<GenericData[]> {
  return fn(cursor).then((res: SlackAPIResponse) => {
    const updatedPartialData = [...partialData, ...getter(res)]
    const updatedCursor = res?.response_metadata?.next_cursor

    if (!updatedCursor) return updatedPartialData
    return fetchAllPaginatedData(fn, getter, updatedPartialData, updatedCursor)
  })
}

function fetchAllChannels(): Promise<ConversationsListResult['channels']> {
  return fetchAllPaginatedData(
    // TODO: figure out a better way to type this without having to typecast, even though
    // typecasting is the official recommendation: https://slack.dev/node-slack-sdk/typescript
    cursor => webClient.conversations.list({cursor, limit: 200, exclude_archived: true}) as Promise<ConversationsListResult>,
    (res: ConversationsListResult) => _.get(res, 'channels'),
  )
}

function fetchAllMembersInChannel(channelId: string): Promise<ConversationsMembersResult['members']> {
  return fetchAllPaginatedData(
    cursor => webClient.conversations.members({channel: channelId, cursor, limit: 200}) as Promise<ConversationsMembersResult>,
    (res: ConversationsMembersResult) => _.get(res, 'members'),
  )
}

function groupChannelsByKey(channels: Channel[], key: string) {
  return _.mapValues(_.groupBy(channels, key) as Record<string, [typeof channels[number]]>, arr => arr[0])
}

function getUserById(userId: string): Promise<SlackUser> {
  const cachedUser = cache?.users?.[userId]
  const cachedDate = cachedUser && cachedUser.date
  if (cachedUser && cachedDate && cachedDate + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cachedUser.profile)

  const apiPromise = webClient.users.profile.get({user: userId}) as Promise<UsersProfileGetResult>
  return apiPromise.then((response: UsersProfileGetResult) => {
    const {profile} = response
    const user: SlackUser = {
      id: userId,
      name: profile.real_name_normalized || profile.display_name_normalized || profile.real_name || profile.display_name || '',
      imgUrl: profile.image_512,
    }
    _.set(cache, `users.${userId}`, {date: Date.now(), profile: user})
    return user
  })
}

export function getSlackChannels(): Promise<Cache['channelsList']> {
  if (!ENABLED) return Promise.reject(new IntegrationDisabledError('Slack integration is disabled'))

  const cacheDate = cache?.channelsList?.date
  if (cacheDate && cacheDate + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.channelsList)
  const startTime = Date.now()
  return fetchAllChannels()
    .then(channels => {
      const slimmedChannels: Channel[]  = channels.map(({id, name, num_members}) => ({id, name, memberCount: num_members}))
      const channelsList = {
        date: startTime,
        channelsById: groupChannelsByKey(slimmedChannels, 'id'),
        channelsByName: _.mapValues(groupChannelsByKey(slimmedChannels, 'name'), channel => channel.id),
      }

      cache.channelsList = channelsList

      log(`Slack channels cache warmed with ${channels.length} channels in ${Date.now() - startTime}ms`)
      return channelsList
    })
}

export function getSlackMembersByChannelId(channelId: string): Promise<SlackUser[]> {
  if (!ENABLED) return Promise.reject(new IntegrationDisabledError('Slack integration is disabled'))

  const cachedMembers = cache?.channelsMembers?.[channelId]
  const cachedDate = cachedMembers && cachedMembers.date

  const memberIdsPromise = (cachedMembers && cachedDate && cachedDate + CACHE_EXPIRATION_MS > Date.now())
    ? Promise.resolve(cachedMembers.members)
    : fetchAllMembersInChannel(channelId)
  
  return memberIdsPromise
    .then(userIds => Promise.all(userIds.map(userId => getUserById(userId))))
    .then(users => users)
}
