import * as _ from 'lodash'
import {WebClient, WebAPICallResult} from '@slack/web-api'

import {AppError} from '../errors'

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

type ID = string

type SlackUser = any

interface Channel {
  name: string
}

interface ConversationsListResult extends WebAPICallResult {
  channels: Channel[]
}

export interface Cache {
  date?: number // Date.now()
  data?: {
    ids?: {[id: string]: SlackUser}
    users?: SlackUser[]
    byChannel?: {[channel: string]: ID[]}
    channels: Channel[]
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
    cursor => webClient.conversations.list({cursor, limit: 1, exclude_archived: true}) as Promise<ConversationsListResult>,
    (res: ConversationsListResult) => _.get(res, 'channels'),
    [],
  )
}

export function getSlackData(): Promise<Cache['data']> {
  if (!ENABLED) {
    const err: AppError = new Error('Slack integration is disabled')
    err.statusCode = 410
    return Promise.reject(err)
  }
  if (cache.date && cache.date + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.data)
  return getAllChannels()
    .then(channels => {
      cache.date = Date.now()
      cache.data = {channels}

      console.log(`[${new Date().toLocaleString('en-US')}] Slack cache warmed with ${channels.length} channels`)
      return cache.data
    })
}
