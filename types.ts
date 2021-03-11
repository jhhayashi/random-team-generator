// generalized user, specific to this app
export interface User {
  id: string
  name: string
  imgUrl?: string
}



// ===========================================
// API Routes
// ===========================================

export interface APIv1Member extends User {}

