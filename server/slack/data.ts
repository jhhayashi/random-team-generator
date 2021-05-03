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

interface UsersListResult extends WebAPICallResult {
  members: {
    id: string
    deleted: boolean
    profile: UsersProfileGetResult['profile']
    is_bot: boolean
    is_email_confirmed: boolean
  }[]
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
  users?: {
    // this date reflects how recently we've fetched all users. we'll also track
    // when each profile was last fetched.
    date: number
    profiles: Record<string, {date: number, profile: SlackUser}>
  }
}

export const cache: Cache = {channelsMembers: {}}

export function warmCache() {
  getSlackChannels()
  getSlackUsers()
}

export function clearCache() {
  delete cache.channelsList
  cache.channelsMembers = {}
  delete cache.users
}

/*
 * Recursively fetches all paginated data.
 * Doesn't cache results, since we'll store a normalized version of the data downstream
 *
 * While it would make the most sense to just blindly fetch data in these functions
 * and postprocess them in the get...() functions later, it makes sense to filter out
 * any invalid values in the fetch...() functions to save memory
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
    cursor => webClient.conversations.list({cursor, limit: 200, exclude_archived: true, types: "public_channel"}) as Promise<ConversationsListResult>,
    // there's no point of keeping channels with no members
    (res: ConversationsListResult) => res.channels.filter(c => !!c.num_members),
  )
}

function fetchAllMembersInChannel(channelId: string): Promise<ConversationsMembersResult['members']> {
  return fetchAllPaginatedData(
    cursor => webClient.conversations.members({channel: channelId, cursor, limit: 200}) as Promise<ConversationsMembersResult>,
    (res: ConversationsMembersResult) => _.get(res, 'members'),
  )
}

function isValidUser(profile: UsersListResult['members'][number]): boolean {
  return !profile.is_bot && !profile.deleted && profile.is_email_confirmed
}

function fetchAllUsers(): Promise<UsersListResult['members']> {
  return fetchAllPaginatedData(
    cursor => webClient.users.list({cursor, limit: 200}) as Promise<UsersListResult>,
    (res: UsersListResult) => res.members.filter(isValidUser),
  )
}

function groupListByKey<T>(arr: T[], key: string): Record<string, T> {
  return _.mapValues(_.groupBy(arr, key) as Record<string, [T]>, arr => arr[0])
}

function convertSlackProfileToUser(user: UsersProfileGetResult['profile'], id: ID): SlackUser {
  const {display_name_normalized, display_name, image_512, real_name_normalized, real_name} = user
  return {
    id,
    name: real_name_normalized || display_name_normalized || real_name || display_name || '',
    imgUrl: image_512,
  }
}

function getUserById(userId: string): Promise<SlackUser> {
  const cachedUser = cache?.users?.profiles?.[userId]
  const cachedDate = cachedUser && cachedUser.date
  if (cachedUser && cachedDate && cachedDate + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cachedUser.profile)

  const apiPromise = webClient.users.profile.get({user: userId}) as Promise<UsersProfileGetResult>
  return apiPromise.then((response: UsersProfileGetResult) => {
    const {profile} = response
    const user = convertSlackProfileToUser(profile, userId)
    _.set(cache, `users.${userId}`, {date: Date.now(), profile: user})
    return user
  })
}

function getUsersById(userIds: string[] | Promise<string[]>): Promise<SlackUser[]> {
  const userIdsPromise = _.isArray(userIds) ? Promise.resolve(userIds) : userIds
  return userIdsPromise.then(userIds => Promise.all(userIds.map(userId => getUserById(userId))))
}

export function getSlackUsers() {
  if (!ENABLED) return Promise.reject(new IntegrationDisabledError('Slack integration is disabled'))

  const cacheDate = cache?.users?.date
  if (cacheDate && cacheDate + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(_.map(cache?.users?.profiles, 'profile'))
  const startTime = Date.now()
  return fetchAllUsers()
    .then((rawMembers) => rawMembers.map(member => convertSlackProfileToUser(member.profile, member.id)))
    .then(users => {
      const profiles = groupListByKey(users, 'id')
      const profilesWithCacheDate = _.mapValues(profiles, profile => ({date: startTime, profile}))
      cache.users = {date: startTime, profiles: profilesWithCacheDate}
      log(`Slack channels cache warmed with ${users.length} users in ${Date.now() - startTime}ms`)
      return users
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
        channelsById: groupListByKey(slimmedChannels, 'id'),
        channelsByName: _.mapValues(groupListByKey(slimmedChannels, 'name'), channel => channel.id),
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

  const usersPromise = (cachedMembers && cachedDate && cachedDate + CACHE_EXPIRATION_MS > Date.now())
    ? Promise.resolve(cachedMembers.members)
    : fetchAllMembersInChannel(channelId)
  return getUsersById(usersPromise)
}

export function getSlackMembersByChannelIds(channelIds: string[]): Promise<SlackUser[]> {
  return Promise.all(channelIds.map(cId => getSlackMembersByChannelId(cId)))
    // dedupe any members that are in multiple channels
    .then(withDupes => _.uniqBy(_.flatten(withDupes), u => u.id))
}
