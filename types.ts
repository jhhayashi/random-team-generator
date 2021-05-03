// generalized user, specific to this app
export interface User {
  id: string
  name: string
  imgUrl: string
}

export interface MultiselectFilterOption {
  name: string
  value?: string // falls back to name if not specified
  imgUrl?: string
}

export interface Filter {
  type: "multiselect" | "checkbox" | "date" | "number"
  name: string // e.g. "manager"
  label?: string // to be shown in the form input label, e.g. "Filter by manager"
  url?: string // where to fetch the MultiselectFilterOptions for a multiselect filter
  min?: number
  max?: number
  defaultValue?: string[] | number
}

export interface Integration {
  name: string
  apiPrefix: string
}

// ===========================================
// Bamboo API Routes
// ===========================================

export interface APIMember extends User {}

export interface APIGroups {
  groups: User[][]
}

export type APITeams = {name: string}[]

export type APIManagers = Pick<User, 'name' | 'imgUrl'>[]

export type APIFilters = Filter[]

// ===========================================
// Slack API Routes
// ===========================================

export type APISlackChannels = (MultiselectFilterOption & {memberCount: number})[]
