import {
  getStoredToken,
} from '@/services/api'

import type {
  AccountProfile,
  AccountProfileUpdate,
  ChangePasswordPayload,
  MessageResponse,
  ProfilePictureResponse,
} from '@/types/account'


class AccountApiError extends Error {
  status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)

    this.name = 'AccountApiError'
    this.status = status
  }
}


async function accountRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers =
    new Headers(
      options.headers,
    )

  const isFormData =
    options.body instanceof FormData


  if (
    !isFormData &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }


  const token =
    getStoredToken()


  if (
    token &&
    !headers.has('Authorization')
  ) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    )
  }


  const response =
    await fetch(
      endpoint,
      {
        ...options,
        headers,
        credentials: 'include',
      },
    )


  let data: unknown = null


  if (
    response.status !== 204
  ) {
    try {
      data =
        await response.json()
    } catch {
      data = null
    }
  }


  if (!response.ok) {
    let message =
      'An unexpected error occurred.'


    if (
      data &&
      typeof data === 'object' &&
      'detail' in data
    ) {
      const detail =
        (
          data as {
            detail?: unknown
          }
        ).detail


      if (
        typeof detail === 'string'
      ) {
        message = detail
      } else if (
        Array.isArray(detail)
      ) {
        message =
          detail
            .map(
              (item) => {
                if (
                  item &&
                  typeof item ===
                    'object' &&
                  'msg' in item
                ) {
                  return String(
                    (
                      item as {
                        msg: unknown
                      }
                    ).msg,
                  )
                }

                return String(item)
              },
            )
            .join(', ')
      }
    }


    throw new AccountApiError(
      message,
      response.status,
    )
  }


  return data as T
}


export const accountApi = {

  // ======================================================
  // GET PROFILE
  // ======================================================

  async getProfile():
    Promise<AccountProfile> {

    return accountRequest<AccountProfile>(
      '/api/account/profile',
    )
  },


  // ======================================================
  // UPDATE PROFILE
  // ======================================================

  async updateProfile(
    data: AccountProfileUpdate,
  ): Promise<AccountProfile> {

    return accountRequest<AccountProfile>(
      '/api/account/profile',
      {
        method: 'PATCH',

        body: JSON.stringify(
          data,
        ),
      },
    )
  },


  // ======================================================
  // UPLOAD PROFILE PICTURE
  // ======================================================

  async uploadProfilePicture(
    file: File,
  ): Promise<ProfilePictureResponse> {

    const formData =
      new FormData()


    formData.append(
      'file',
      file,
    )


    return accountRequest<ProfilePictureResponse>(
      '/api/account/profile-picture',
      {
        method: 'POST',

        body: formData,
      },
    )
  },


  // ======================================================
  // REMOVE PROFILE PICTURE
  // ======================================================

  async removeProfilePicture():
    Promise<ProfilePictureResponse> {

    return accountRequest<ProfilePictureResponse>(
      '/api/account/profile-picture',
      {
        method: 'DELETE',
      },
    )
  },


  // ======================================================
  // CHANGE PASSWORD
  // ======================================================

  async changePassword(
    data: ChangePasswordPayload,
  ): Promise<MessageResponse> {

    return accountRequest<MessageResponse>(
      '/api/account/change-password',
      {
        method: 'POST',

        body: JSON.stringify(
          data,
        ),
      },
    )
  },

}