import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  useAuth,
} from '@/context/AuthContext'

import {
  accountApi,
} from '@/services/accountApi'

import {
  Badge,
} from '@/components/ui/Badge'

import {
  Button,
} from '@/components/ui/Button'

import {
  Card,
} from '@/components/ui/Card'

import {
  Input,
} from '@/components/ui/Input'

import {
  SEO,
} from '@/components/ui/SEO'

import type {
  AccountProfile,
} from '@/types/account'


function formatDate(
  value: string,
) {
  return new Intl
    .DateTimeFormat(
      'en-PH',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      },
    )
    .format(
      new Date(value),
    )
}


function initials(
  name: string,
) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
          ?.toUpperCase()
        ?? '',
    )
    .join('')
}


export function MemberSettingsPage() {
  const {
    user,
    refreshUser,
  } =
    useAuth()


  const navigate =
    useNavigate()


  const fileInputRef =
    useRef<
      HTMLInputElement | null
    >(null)


  const [
    profile,
    setProfile,
  ] =
    useState<
      AccountProfile | null
    >(null)


  const [
    loading,
    setLoading,
  ] =
    useState(true)


  const [
    pageError,
    setPageError,
  ] =
    useState('')


  // ======================================================
  // PROFILE INFORMATION
  // ======================================================

  const [
    fullName,
    setFullName,
  ] =
    useState('')


  const [
    email,
    setEmail,
  ] =
    useState('')


  const [
    phone,
    setPhone,
  ] =
    useState('')


  const [
    emailPassword,
    setEmailPassword,
  ] =
    useState('')


  const [
    profileSaving,
    setProfileSaving,
  ] =
    useState(false)


  const [
    profileMessage,
    setProfileMessage,
  ] =
    useState('')


  const [
    profileError,
    setProfileError,
  ] =
    useState('')


  // ======================================================
  // PROFILE PICTURE
  // ======================================================

  const [
    pictureUploading,
    setPictureUploading,
  ] =
    useState(false)


  const [
    pictureMessage,
    setPictureMessage,
  ] =
    useState('')


  const [
    pictureError,
    setPictureError,
  ] =
    useState('')


  // ======================================================
  // PASSWORD
  // ======================================================

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState('')


  const [
    newPassword,
    setNewPassword,
  ] =
    useState('')


  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('')


  const [
    passwordSaving,
    setPasswordSaving,
  ] =
    useState(false)


  const [
    passwordMessage,
    setPasswordMessage,
  ] =
    useState('')


  const [
    passwordError,
    setPasswordError,
  ] =
    useState('')


  // ======================================================
  // LOAD PROFILE
  // ======================================================

  useEffect(() => {
    let active = true


    async function loadProfile() {
      setLoading(true)

      setPageError('')


      try {
        const data =
          await accountApi
            .getProfile()


        if (!active) {
          return
        }


        setProfile(
          data,
        )


        setFullName(
          data.full_name,
        )


        setEmail(
          data.email,
        )


        setPhone(
          data.phone ?? '',
        )

      } catch (err) {

        if (!active) {
          return
        }


        setPageError(
          err instanceof Error
            ? err.message
            : 'Unable to load account settings.',
        )

      } finally {

        if (active) {
          setLoading(false)
        }
      }
    }


    loadProfile()


    return () => {
      active = false
    }

  }, [])


  // ======================================================
  // CHECK IF EMAIL CHANGED
  // ======================================================

  const emailChanged =
    useMemo(
      () => {

        if (!profile) {
          return false
        }


        return (
          email
            .trim()
            .toLowerCase()
          !==
          profile.email
            .toLowerCase()
        )

      },
      [
        email,
        profile,
      ],
    )


  // ======================================================
  // SAVE PROFILE
  // ======================================================

  const handleProfileSave =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {

      event.preventDefault()


      setProfileMessage('')

      setProfileError('')


      if (!fullName.trim()) {
        setProfileError(
          'Full name is required.',
        )

        return
      }


      if (!email.trim()) {
        setProfileError(
          'Email address is required.',
        )

        return
      }


      if (
        emailChanged &&
        !emailPassword
      ) {
        setProfileError(
          'Enter your current password to change your email address.',
        )

        return
      }


      setProfileSaving(true)


      try {
        const updated =
          await accountApi
            .updateProfile({
              full_name:
                fullName.trim(),

              email:
                email.trim(),

              phone:
                phone.trim(),

              ...(
                emailChanged
                  ? {
                      current_password:
                        emailPassword,
                    }
                  : {}
              ),
            })


        setProfile(
          updated,
        )


        setFullName(
          updated.full_name,
        )


        setEmail(
          updated.email,
        )


        setPhone(
          updated.phone ?? '',
        )


        setEmailPassword('')


        setProfileMessage(
          'Profile updated successfully.',
        )


        await refreshUser()

      } catch (err) {

        setProfileError(
          err instanceof Error
            ? err.message
            : 'Unable to update profile.',
        )

      } finally {

        setProfileSaving(false)
      }
    }


  // ======================================================
  // UPLOAD PROFILE PICTURE
  // ======================================================

  const handlePictureSelect =
    async (
      event:
        ChangeEvent<HTMLInputElement>,
    ) => {

      const file =
        event.target.files?.[0]


      if (!file) {
        return
      }


      setPictureMessage('')

      setPictureError('')


      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ]


      if (
        !validTypes.includes(
          file.type,
        )
      ) {
        setPictureError(
          'Use a JPG, PNG, or WEBP image.',
        )

        event.target.value = ''

        return
      }


      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setPictureError(
          'Profile picture must be 5 MB or smaller.',
        )

        event.target.value = ''

        return
      }


      setPictureUploading(true)


      try {
        const result =
          await accountApi
            .uploadProfilePicture(
              file,
            )


        setProfile(
          (current) =>
            current
              ? {
                  ...current,

                  profile_picture_url:
                    result
                      .profile_picture_url,
                }
              : current,
        )


        setPictureMessage(
          'Profile picture updated successfully.',
        )


        window.dispatchEvent(
          new Event(
            'dgym-profile-picture-updated',
          ),
        )

      } catch (err) {

        setPictureError(
          err instanceof Error
            ? err.message
            : 'Unable to upload profile picture.',
        )

      } finally {

        setPictureUploading(false)

        event.target.value = ''
      }
    }


  // ======================================================
  // REMOVE PROFILE PICTURE
  // ======================================================

  const handleRemovePicture =
    async () => {

      setPictureMessage('')

      setPictureError('')

      setPictureUploading(true)


      try {
        await accountApi
          .removeProfilePicture()


        setProfile(
          (current) =>
            current
              ? {
                  ...current,

                  profile_picture_url:
                    null,
                }
              : current,
        )


        setPictureMessage(
          'Profile picture removed.',
        )


        window.dispatchEvent(
          new Event(
            'dgym-profile-picture-updated',
          ),
        )

      } catch (err) {

        setPictureError(
          err instanceof Error
            ? err.message
            : 'Unable to remove profile picture.',
        )

      } finally {

        setPictureUploading(false)
      }
    }


  // ======================================================
  // CHANGE PASSWORD
  // ======================================================

  const handlePasswordChange =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {

      event.preventDefault()


      setPasswordMessage('')

      setPasswordError('')


      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        setPasswordError(
          'Complete all password fields.',
        )

        return
      }


      if (
        newPassword.length < 8
      ) {
        setPasswordError(
          'New password must be at least 8 characters.',
        )

        return
      }


      if (
        newPassword
        !== confirmPassword
      ) {
        setPasswordError(
          'New passwords do not match.',
        )

        return
      }


      setPasswordSaving(true)


      try {
        const response =
          await accountApi
            .changePassword({
              current_password:
                currentPassword,

              new_password:
                newPassword,

              confirm_new_password:
                confirmPassword,
            })


        setCurrentPassword('')

        setNewPassword('')

        setConfirmPassword('')


        setPasswordMessage(
          response.message,
        )

      } catch (err) {

        setPasswordError(
          err instanceof Error
            ? err.message
            : 'Unable to change password.',
        )

      } finally {

        setPasswordSaving(false)
      }
    }


  // ======================================================
  // WAIT FOR USER
  // ======================================================

  if (!user) {
    return null
  }


  return (
    <>
      <SEO
        title="Account Settings"

        description="
          Manage your DGYM member profile,
          profile picture,
          password,
          and account status.
        "
      />


      <div
        className="
          p-6
          md:p-8
          max-w-5xl
          mx-auto
        "
      >

        {/* PAGE HEADER */}

        <div
          className="
            flex
            flex-col
            gap-5
            border-b
            border-white/8
            pb-7
            mb-8
            md:flex-row
            md:items-end
            md:justify-between
          "
        >

          <div>

            <p
              className="
                text-xs
                uppercase
                tracking-[0.2em]
                text-white/35
                font-mono
                mb-2
              "
            >
              Member Account
            </p>


            <h1
              className="
                font-display
                text-3xl
                md:text-5xl
                font-black
                uppercase
                tracking-tight
                text-white
              "
            >
              Account Settings
            </h1>


            <p
              className="
                text-sm
                text-white/50
                mt-2
                max-w-2xl
              "
            >
              Manage your personal information,
              profile photo,
              password,
              and account status.
            </p>

          </div>


          <Button
            variant="secondary"

            onClick={() =>
              navigate(
                '/dashboard',
              )
            }
          >
            Back to Dashboard
          </Button>

        </div>


        {/* PAGE ERROR */}

        {pageError && (

          <div
            className="
              mb-6
              rounded-xl
              border
              border-danger/25
              bg-danger/10
              px-4
              py-3
              text-sm
              text-danger
            "
          >
            {pageError}
          </div>

        )}


        {/* LOADING */}

        {loading ? (

          <div className="grid gap-6">

            <div
              className="
                h-64
                animate-pulse
                rounded-2xl
                border
                border-white/8
                bg-surface
              "
            />

            <div
              className="
                h-72
                animate-pulse
                rounded-2xl
                border
                border-white/8
                bg-surface
              "
            />

          </div>

        ) : profile ? (

          <div className="space-y-6">

            {/* ==================================================
                PROFILE PICTURE
            ================================================== */}

            <Card className="p-6 md:p-8">

              <div
                className="
                  flex
                  flex-col
                  gap-6
                  md:flex-row
                  md:items-center
                  md:justify-between
                "
              >

                <div
                  className="
                    flex
                    items-center
                    gap-5
                  "
                >

                  <div
                    className="
                      relative
                      h-24
                      w-24
                      shrink-0
                      overflow-hidden
                      rounded-2xl
                      border
                      border-white/10
                      bg-red/15
                    "
                  >

                    {profile
                      .profile_picture_url
                    ? (

                      <img
                        src={
                          profile
                            .profile_picture_url
                        }

                        alt={
                          `${profile.full_name} profile`
                        }

                        className="
                          h-full
                          w-full
                          object-cover
                        "
                      />

                    ) : (

                      <div
                        className="
                          flex
                          h-full
                          w-full
                          items-center
                          justify-center
                          font-display
                          text-3xl
                          font-black
                          text-red
                        "
                      >
                        {initials(
                          profile.full_name,
                        )}
                      </div>

                    )}

                  </div>


                  <div>

                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        mb-1
                      "
                    >

                      <h2
                        className="
                          font-display
                          text-2xl
                          font-black
                          uppercase
                          text-white
                        "
                      >
                        {profile.full_name}
                      </h2>


                      <Badge
                        variant={
                          profile.is_active
                            ? 'success'
                            : 'danger'
                        }

                        dot
                      >
                        {profile.is_active
                          ? 'ACTIVE'
                          : 'INACTIVE'}
                      </Badge>

                    </div>


                    <p
                      className="
                        text-sm
                        text-white/50
                      "
                    >
                      {profile.email}
                    </p>


                    <p
                      className="
                        mt-2
                        text-xs
                        uppercase
                        tracking-widest
                        text-white/30
                        font-mono
                      "
                    >
                      Member since{' '}
                      {formatDate(
                        profile.created_at,
                      )}
                    </p>

                  </div>

                </div>


                <div
                  className="
                    flex
                    flex-wrap
                    gap-2
                  "
                >

                  <input
                    ref={fileInputRef}

                    type="file"

                    accept="
                      image/jpeg,
                      image/png,
                      image/webp
                    "

                    onChange={
                      handlePictureSelect
                    }

                    className="hidden"
                  />


                  <Button
                    type="button"

                    variant="secondary"

                    loading={
                      pictureUploading
                    }

                    onClick={() =>
                      fileInputRef
                        .current
                        ?.click()
                    }
                  >
                    Upload Photo
                  </Button>


                  {profile
                    .profile_picture_url
                  && (

                    <Button
                      type="button"

                      variant="ghost"

                      disabled={
                        pictureUploading
                      }

                      onClick={
                        handleRemovePicture
                      }
                    >
                      Remove
                    </Button>

                  )}

                </div>

              </div>


              <div className="mt-5">

                {pictureMessage && (

                  <p
                    className="
                      text-sm
                      text-success
                    "
                  >
                    {pictureMessage}
                  </p>

                )}


                {pictureError && (

                  <p
                    className="
                      text-sm
                      text-danger
                    "
                  >
                    {pictureError}
                  </p>

                )}


                <p
                  className="
                    mt-2
                    text-xs
                    text-white/30
                  "
                >
                  JPG, PNG, or WEBP.
                  Maximum file size:
                  5 MB.
                </p>

              </div>

            </Card>


            {/* ==================================================
                PERSONAL INFORMATION
            ================================================== */}

            <Card className="p-6 md:p-8">

              <div className="mb-6">

                <p
                  className="
                    text-xs
                    uppercase
                    tracking-widest
                    text-red
                    font-mono
                    mb-1
                  "
                >
                  Profile
                </p>


                <h2
                  className="
                    font-display
                    text-2xl
                    font-black
                    uppercase
                    text-white
                  "
                >
                  Personal Information
                </h2>


                <p
                  className="
                    text-sm
                    text-white/45
                    mt-1
                  "
                >
                  Update the information
                  connected to your
                  member login.
                </p>

              </div>


              <form
                onSubmit={
                  handleProfileSave
                }

                className="
                  space-y-5
                "
              >

                {profileMessage && (

                  <div
                    className="
                      rounded-lg
                      border
                      border-success/20
                      bg-success/10
                      px-4
                      py-3
                      text-sm
                      text-success
                    "
                  >
                    {profileMessage}
                  </div>

                )}


                {profileError && (

                  <div
                    className="
                      rounded-lg
                      border
                      border-danger/20
                      bg-danger/10
                      px-4
                      py-3
                      text-sm
                      text-danger
                    "
                  >
                    {profileError}
                  </div>

                )}


                <div
                  className="
                    grid
                    gap-5
                    md:grid-cols-2
                  "
                >

                  <Input
                    label="Full Name"

                    value={
                      fullName
                    }

                    onChange={
                      (event) =>
                        setFullName(
                          event
                            .target
                            .value,
                        )
                    }

                    placeholder="
                      Your full name
                    "

                    required
                  />


                  <Input
                    label="
                      Phone Number
                    "

                    value={
                      phone
                    }

                    onChange={
                      (event) =>
                        setPhone(
                          event
                            .target
                            .value,
                        )
                    }

                    placeholder="
                      +63 9XX XXX XXXX
                    "
                  />

                </div>


                <Input
                  label="Email Address"

                  type="email"

                  value={email}

                  onChange={
                    (event) =>
                      setEmail(
                        event
                          .target
                          .value,
                      )
                  }

                  required
                />


                {emailChanged && (

                  <Input
                    label="
                      Current Password
                    "

                    type="password"

                    value={
                      emailPassword
                    }

                    onChange={
                      (event) =>
                        setEmailPassword(
                          event
                            .target
                            .value,
                        )
                    }

                    hint="
                      Required because
                      you are changing
                      your email address.
                    "

                    autoComplete="
                      current-password
                    "

                    required
                  />

                )}


                <div
                  className="
                    flex
                    justify-end
                    border-t
                    border-white/8
                    pt-5
                  "
                >

                  <Button
                    type="submit"

                    loading={
                      profileSaving
                    }
                  >
                    Save Profile
                  </Button>

                </div>

              </form>

            </Card>


            {/* ==================================================
                CHANGE PASSWORD
            ================================================== */}

            <Card className="p-6 md:p-8">

              <div className="mb-6">

                <p
                  className="
                    text-xs
                    uppercase
                    tracking-widest
                    text-red
                    font-mono
                    mb-1
                  "
                >
                  Security
                </p>


                <h2
                  className="
                    font-display
                    text-2xl
                    font-black
                    uppercase
                    text-white
                  "
                >
                  Change Password
                </h2>


                <p
                  className="
                    text-sm
                    text-white/45
                    mt-1
                  "
                >
                  Enter your current
                  password and choose
                  a new password with
                  at least 8 characters.
                </p>

              </div>


              <form
                onSubmit={
                  handlePasswordChange
                }

                className="
                  space-y-5
                "
              >

                {passwordMessage && (

                  <div
                    className="
                      rounded-lg
                      border
                      border-success/20
                      bg-success/10
                      px-4
                      py-3
                      text-sm
                      text-success
                    "
                  >
                    {passwordMessage}
                  </div>

                )}


                {passwordError && (

                  <div
                    className="
                      rounded-lg
                      border
                      border-danger/20
                      bg-danger/10
                      px-4
                      py-3
                      text-sm
                      text-danger
                    "
                  >
                    {passwordError}
                  </div>

                )}


                <Input
                  label="
                    Current Password
                  "

                  type="password"

                  value={
                    currentPassword
                  }

                  onChange={
                    (event) =>
                      setCurrentPassword(
                        event
                          .target
                          .value,
                      )
                  }

                  autoComplete="
                    current-password
                  "

                  required
                />


                <div
                  className="
                    grid
                    gap-5
                    md:grid-cols-2
                  "
                >

                  <Input
                    label="
                      New Password
                    "

                    type="password"

                    value={
                      newPassword
                    }

                    onChange={
                      (event) =>
                        setNewPassword(
                          event
                            .target
                            .value,
                        )
                    }

                    autoComplete="
                      new-password
                    "

                    required
                  />


                  <Input
                    label="
                      Confirm New Password
                    "

                    type="password"

                    value={
                      confirmPassword
                    }

                    onChange={
                      (event) =>
                        setConfirmPassword(
                          event
                            .target
                            .value,
                        )
                    }

                    autoComplete="
                      new-password
                    "

                    required
                  />

                </div>


                <div
                  className="
                    flex
                    justify-end
                    border-t
                    border-white/8
                    pt-5
                  "
                >

                  <Button
                    type="submit"

                    loading={
                      passwordSaving
                    }
                  >
                    Change Password
                  </Button>

                </div>

              </form>

            </Card>


            {/* ==================================================
                ACCOUNT STATUS - READ ONLY
            ================================================== */}

            <Card className="p-6 md:p-8">

              <div
                className="
                  flex
                  flex-col
                  gap-4
                  md:flex-row
                  md:items-center
                  md:justify-between
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-widest
                      text-red
                      font-mono
                      mb-1
                    "
                  >
                    Account Status
                  </p>


                  <h2
                    className="
                      font-display
                      text-2xl
                      font-black
                      uppercase
                      text-white
                    "
                  >
                    Member Account
                  </h2>


                  <p
                    className="
                      text-sm
                      text-white/45
                      mt-1
                      max-w-2xl
                    "
                  >
                    Your account status
                    is managed by
                    The DGym administration.
                  </p>

                </div>


                <Badge
                  variant={
                    profile.is_active
                      ? 'success'
                      : 'danger'
                  }

                  dot

                  size="md"
                >
                  {profile.is_active
                    ? 'ACTIVE'
                    : 'INACTIVE'}
                </Badge>

              </div>

            </Card>

          </div>

        ) : null}

      </div>
    </>
  )
}