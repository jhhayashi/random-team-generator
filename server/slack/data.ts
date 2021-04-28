import * as _ from 'lodash'
import {WebClient, WebAPICallResult} from '@slack/web-api'

import {AppError} from '../errors'

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

type ID = string

type SlackUser = any

interface Channel {
  id: ID
  name: string
  num_members: number
}

interface ConversationsListResult extends WebAPICallResult {
  channels: Channel[]
}

export interface Cache {
  date?: number // Date.now()
  data?: {
    usersById?: {[id: string]: SlackUser}
    channelsById?: {[id: string]: Channel}
    channelsByName?: {[name: string]: ID}
  }
}

export const cache: Cache = {}

export function clearCache() {
  delete cache.date
  delete cache.data
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

function getChannelsByKey(channels: Channel[], key: string) {
  return _.mapValues(_.groupBy(channels, key) as Record<string, [typeof channels[number]]>, arr => arr[0])
}

function getNormalizedCache(channels: Channel[]): Cache {
  const slimmedChannels = channels.map(channel => _.pick(channel, CACHED_CHANNEL_KEYS))
  return {
    date: Date.now(),
    data: {
      channelsById: getChannelsByKey(slimmedChannels, 'id'),
      channelsByName: _.mapValues(getChannelsByKey(slimmedChannels, 'name'), channel => channel.id),
    },
  }
}

export function getSlackData(): Promise<Cache['data']> {
  if (!ENABLED) {
    const err: AppError = new Error('Slack integration is disabled')
    err.statusCode = 410
    return Promise.reject(err)
  }
  if (cache.date && cache.date + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.data)
  const startTime = Date.now()
  return getAllChannels()
    .then(channels => {
      Object.assign(cache, getNormalizedCache(channels))

      console.log(`[${new Date().toLocaleString('en-US')}] Slack cache warmed with ${channels.length} channels in ${Date.now() - startTime}ms`)
      return cache.data
    })
}
