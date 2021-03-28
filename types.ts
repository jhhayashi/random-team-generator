// generalized user, specific to this app
export interface User {
  id: string
  name: string
  imgUrl: string
}



// ===========================================
// API Routes
// ===========================================

export interface APIv1Member extends User {}

export interface APIv1Groups {
  groups: User[][]
}

export type APIv1Teams = {name: string}[]

export type APIv1Managers = Pick<User, 'name' | 'imgUrl'>[]
