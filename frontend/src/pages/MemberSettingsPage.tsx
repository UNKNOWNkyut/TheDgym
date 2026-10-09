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


// ======================================================
// HELPERS
// ======================================================

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  ).format(
    new Date(value),
  )
}


function getInitials(
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


// ======================================================
// PAGE
// ======================================================

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


  // ======================================================
  // PROFILE
  // ======================================================

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
  // EDIT MODE
  // ======================================================

  const [
    isEditing,
    setIsEditing,
  ] =
    useState(false)


  // ======================================================
  // PROFILE FIELDS
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
  // CHANGE PASSWORD MODAL
  // ======================================================

  const [
    passwordModalOpen,
    setPasswordModalOpen,
  ] =
    useState(false)


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
    showCurrentPassword,
    setShowCurrentPassword,
  ] =
    useState(false)


  const [
    showNewPassword,
    setShowNewPassword,
  ] =
    useState(false)


  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] =
    useState(false)


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


        setProfile(data)

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
  // ESC CLOSE PASSWORD MODAL
  // ======================================================

  useEffect(() => {

    if (!passwordModalOpen) {
      return
    }


    const handleKeyDown =
      (
        event: KeyboardEvent,
      ) => {

        if (
          event.key === 'Escape'
        ) {
          closePasswordModal()
        }
      }


    window.addEventListener(
      'keydown',
      handleKeyDown,
    )


    return () => {

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }

  }, [
    passwordModalOpen,
  ])


  // ======================================================
  // EMAIL CHANGED?
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
          profile
            .email
            .toLowerCase()
        )

      },
      [
        email,
        profile,
      ],
    )


  // ======================================================
  // START EDITING
  // ======================================================

  const startEditing =
    () => {

      if (!profile) {
        return
      }


      setFullName(
        profile.full_name,
      )

      setEmail(
        profile.email,
      )

      setPhone(
        profile.phone ?? '',
      )

      setEmailPassword('')

      setProfileMessage('')

      setProfileError('')

      setPictureMessage('')

      setPictureError('')

      setIsEditing(true)
    }


  // ======================================================
  // CANCEL EDITING
  // ======================================================

  const cancelEditing =
    () => {

      if (profile) {

        setFullName(
          profile.full_name,
        )

        setEmail(
          profile.email,
        )

        setPhone(
          profile.phone ?? '',
        )
      }


      setEmailPassword('')

      setProfileMessage('')

      setProfileError('')

      setPictureMessage('')

      setPictureError('')

      setPasswordModalOpen(false)

      setIsEditing(false)
    }


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


        setProfile(updated)

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


        await refreshUser()


        window.dispatchEvent(
          new Event(
            'dgym-profile-updated',
          ),
        )


        setProfileMessage(
          'Profile updated successfully.',
        )


        setIsEditing(false)

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
  // AVATAR CLICK
  // ======================================================

  const handleAvatarClick =
    () => {

      if (
        !isEditing ||
        pictureUploading
      ) {
        return
      }


      fileInputRef
        .current
        ?.click()
    }


  // ======================================================
  // PROFILE PICTURE UPLOAD
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
      ]


      if (
        !validTypes.includes(
          file.type,
        )
      ) {

        setPictureError(
          'Profile picture must be PNG, JPG, or JPEG.',
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
          'Profile picture updated.',
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
  // PASSWORD MODAL
  // ======================================================

  const openPasswordModal =
    () => {

      setCurrentPassword('')

      setNewPassword('')

      setConfirmPassword('')

      setPasswordMessage('')

      setPasswordError('')

      setShowCurrentPassword(false)

      setShowNewPassword(false)

      setShowConfirmPassword(false)

      setPasswordModalOpen(true)
    }


  const closePasswordModal =
    () => {

      if (passwordSaving) {
        return
      }


      setPasswordModalOpen(false)

      setCurrentPassword('')

      setNewPassword('')

      setConfirmPassword('')

      setPasswordMessage('')

      setPasswordError('')

      setShowCurrentPassword(false)

      setShowNewPassword(false)

      setShowConfirmPassword(false)
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
        newPassword !==
        confirmPassword
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
  // AUTH
  // ======================================================

  if (!user) {
    return null
  }


  return (
    <>
      <SEO
        title="Account Settings"

        description="
          Manage your DGYM member profile.
        "
      />


      <div
        className="
          min-h-screen
          bg-black
          text-white
        "
      >

        {/* ==================================================
            TOP HEADER
        ================================================== */}

        <header
          className="
            border-b
            border-white/8
            bg-surface/95
            backdrop-blur
          "
        >

          <div
            className="
              mx-auto
              flex
              max-w-6xl
              items-center
              justify-between
              gap-4
              px-4
              py-4
              md:px-8
            "
          >

            <button
              type="button"

              onClick={() =>
                navigate(
                  '/dashboard',
                )
              }

              aria-label="
                Back to dashboard
              "
            >

              <img
                src="/assets/logos/thedgym.png"

                alt="The DGym"

                className="
                  h-9
                  w-auto
                  object-contain
                  md:h-10
                "
              />

            </button>


            <Button
              type="button"

              variant="secondary"

              size="sm"

              onClick={() =>
                navigate(
                  '/dashboard',
                )
              }
            >

              <svg
                className="
                  h-4
                  w-4
                "

                fill="none"

                stroke="currentColor"

                viewBox="0 0 24 24"
              >

                <path
                  strokeLinecap="round"

                  strokeLinejoin="round"

                  strokeWidth={1.8}

                  d="
                    M15 19
                    l-7-7
                    7-7
                  "
                />

              </svg>


              Back to Dashboard

            </Button>

          </div>

        </header>


        {/* ==================================================
            PAGE CONTENT
        ================================================== */}

        <main
          className="
            mx-auto
            max-w-5xl
            px-4
            py-8
            md:px-8
            md:py-12
          "
        >

          {/* TITLE */}

          <div className="mb-8">

            <p
              className="
                mb-2
                font-mono
                text-xs
                uppercase
                tracking-[0.2em]
                text-white/35
              "
            >
              Member Account
            </p>


            <h1
              className="
                font-display
                text-4xl
                font-black
                uppercase
                tracking-tight
                md:text-5xl
              "
            >
              Account Settings
            </h1>


            <p
              className="
                mt-2
                text-sm
                text-white/50
              "
            >
              View and manage your
              profile information.
            </p>

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


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (

            <div
              className="
                h-[430px]
                animate-pulse
                rounded-xl
                border
                border-white/8
                bg-surface
              "
            />

          ) : profile ? (

            /* ==================================================
                PROFILE CARD
            ================================================== */

            <Card
              className="
                relative
                p-6
                md:p-8
              "
            >

              {/* CARD HEADER */}

              <div
                className="
                  mb-7
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >

                <div>

                  <p
                    className="
                      mb-1
                      font-mono
                      text-xs
                      uppercase
                      tracking-widest
                      text-red
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
                    "
                  >
                    Profile Information
                  </h2>


                  <p
                    className="
                      mt-1
                      text-sm
                      text-white/45
                    "
                  >

                    {isEditing
                      ? 'You can now edit your profile information.'
                      : 'Your account information.'}

                  </p>

                </div>


                {/* PENCIL */}

                {!isEditing && (

                  <button
                    type="button"

                    onClick={
                      startEditing
                    }

                    title="
                      Edit Profile
                    "

                    aria-label="
                      Edit Profile
                    "

                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      border
                      border-white/10
                      bg-white/[0.03]
                      text-white/50
                      transition
                      hover:border-red/40
                      hover:bg-red/10
                      hover:text-red
                    "
                  >

                    <svg
                      className="
                        h-5
                        w-5
                      "

                      fill="none"

                      stroke="currentColor"

                      viewBox="0 0 24 24"
                    >

                      <path
                        strokeLinecap="round"

                        strokeLinejoin="round"

                        strokeWidth={1.7}

                        d="
                          M16.862 3.487
                          a2.121 2.121 0 013 3
                          L8.75 17.598
                          4 19
                          l1.402-4.75
                          L16.862 3.487z
                        "
                      />


                      <path
                        strokeLinecap="round"

                        strokeLinejoin="round"

                        strokeWidth={1.7}

                        d="
                          M15.5 5
                          l3 3
                        "
                      />

                    </svg>

                  </button>

                )}

              </div>


              {/* ==================================================
                  PROFILE GRID
              ================================================== */}

              <div
                className="
                  grid
                  gap-8
                  lg:grid-cols-[220px_minmax(0,1fr)]
                "
              >

                {/* ==================================================
                    AVATAR
                ================================================== */}

                <div>

                  <input
                    ref={
                      fileInputRef
                    }

                    type="file"

                    accept="
                      image/png,
                      image/jpeg,
                      .png,
                      .jpg,
                      .jpeg
                    "

                    onChange={
                      handlePictureSelect
                    }

                    className="hidden"
                  />


                  <button
                    type="button"

                    onClick={
                      handleAvatarClick
                    }

                    disabled={
                      !isEditing ||
                      pictureUploading
                    }

                    className={`
                      relative
                      mx-auto
                      block
                      h-44
                      w-44
                      overflow-hidden
                      rounded-full
                      border
                      bg-surface-2
                      transition
                      lg:mx-0

                      ${
                        isEditing
                          ? `
                            cursor-pointer
                            border-red/35
                            hover:border-red/60
                          `
                          : `
                            cursor-default
                            border-white/10
                          `
                      }
                    `}
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
                          bg-red/10
                          font-display
                          text-5xl
                          font-black
                          text-red
                        "
                      >

                        {getInitials(
                          profile.full_name,
                        )}

                      </div>

                    )}


                    {/* UPLOAD OVERLAY */}

                    {isEditing && (

                      <div
                        className="
                          absolute
                          inset-0
                          flex
                          flex-col
                          items-center
                          justify-center
                          gap-2
                          bg-black/60
                          text-white
                          opacity-80
                          transition
                          hover:opacity-100
                        "
                      >

                        {pictureUploading ? (

                          <span
                            className="
                              h-7
                              w-7
                              animate-spin
                              rounded-full
                              border-2
                              border-white/30
                              border-t-white
                            "
                          />

                        ) : (

                          <>

                            <svg
                              className="
                                h-8
                                w-8
                              "

                              fill="none"

                              stroke="currentColor"

                              viewBox="0 0 24 24"
                            >

                              <path
                                strokeLinecap="round"

                                strokeLinejoin="round"

                                strokeWidth={1.7}

                                d="
                                  M4 16v2
                                  a2 2 0 002 2h12
                                  a2 2 0 002-2v-2
                                  M12 4v11
                                  m0-11l-4 4
                                  m4-4l4 4
                                "
                              />

                            </svg>


                            <span
                              className="
                                text-[11px]
                                font-semibold
                                uppercase
                                tracking-wider
                              "
                            >
                              Change Photo
                            </span>

                          </>

                        )}

                      </div>

                    )}

                  </button>


                  <div
                    className="
                      mt-4
                      text-center
                      lg:text-left
                    "
                  >

                    {isEditing && (

                      <p
                        className="
                          text-xs
                          text-white/35
                        "
                      >
                        PNG, JPG or JPEG.
                        Maximum 5 MB.
                      </p>

                    )}


                    {pictureMessage && (

                      <p
                        className="
                          mt-2
                          text-xs
                          text-success
                        "
                      >
                        {pictureMessage}
                      </p>

                    )}


                    {pictureError && (

                      <p
                        className="
                          mt-2
                          text-xs
                          text-danger
                        "
                      >
                        {pictureError}
                      </p>

                    )}

                  </div>

                </div>


                {/* ==================================================
                    PROFILE DETAILS
                ================================================== */}

                <div className="min-w-0">

                  {profileMessage && (

                    <div
                      className="
                        mb-5
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
                        mb-5
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


                  {/* ==================================================
                      EDIT MODE
                  ================================================== */}

                  {isEditing ? (

                    <form
                      onSubmit={
                        handleProfileSave
                      }

                      className="
                        space-y-5
                      "
                    >

                      <div
                        className="
                          grid
                          gap-5
                          md:grid-cols-2
                        "
                      >

                        <Input
                          label="
                            Full Name
                          "

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
                        label="
                          Email Address
                        "

                        type="email"

                        value={
                          email
                        }

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


                      {/* EMAIL PASSWORD */}

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
                            Required to change your login email.
                          "

                          required
                        />

                      )}


                      {/* ==================================================
                          CHANGE PASSWORD INSIDE EDIT MODE
                      ================================================== */}

                      <div
                        className="
                          rounded-xl
                          border
                          border-white/8
                          bg-white/[0.02]
                          p-4
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-4
                          "
                        >

                          <div>

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-white
                              "
                            >
                              Password
                            </p>


                            <p
                              className="
                                mt-1
                                text-xs
                                text-white/40
                              "
                            >
                              Update your
                              account password.
                            </p>

                          </div>


                          <button
                            type="button"

                            onClick={
                              openPasswordModal
                            }

                            className="
                              rounded-lg
                              border
                              border-white/10
                              bg-white/[0.03]
                              px-4
                              py-2
                              text-xs
                              font-semibold
                              text-white/70
                              transition
                              hover:border-red/35
                              hover:bg-red/10
                              hover:text-red
                            "
                          >
                            Change Password
                          </button>

                        </div>

                      </div>


                      {/* CANCEL / SAVE */}

                      <div
                        className="
                          flex
                          flex-col-reverse
                          gap-3
                          border-t
                          border-white/8
                          pt-5
                          sm:flex-row
                          sm:justify-end
                        "
                      >

                        <Button
                          type="button"

                          variant="secondary"

                          onClick={
                            cancelEditing
                          }

                          disabled={
                            profileSaving
                          }
                        >
                          Cancel
                        </Button>


                        <Button
                          type="submit"

                          loading={
                            profileSaving
                          }
                        >
                          Save Changes
                        </Button>

                      </div>

                    </form>

                  ) : (

                    /* ==================================================
                        READ ONLY MODE
                    ================================================== */

                    <div className="space-y-1">

                      {/* FULL NAME */}

                      <div
                        className="
                          grid
                          gap-3
                          border-b
                          border-white/8
                          py-4
                          sm:grid-cols-[170px_minmax(0,1fr)]
                          sm:items-center
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-medium
                            uppercase
                            tracking-wider
                            text-white/35
                          "
                        >
                          Full Name
                        </p>


                        <p
                          className="
                            break-words
                            text-sm
                            font-medium
                            text-white
                          "
                        >
                          {profile.full_name}
                        </p>

                      </div>


                      {/* EMAIL */}

                      <div
                        className="
                          grid
                          gap-3
                          border-b
                          border-white/8
                          py-4
                          sm:grid-cols-[170px_minmax(0,1fr)]
                          sm:items-center
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-medium
                            uppercase
                            tracking-wider
                            text-white/35
                          "
                        >
                          Email Address
                        </p>


                        <p
                          className="
                            break-words
                            text-sm
                            font-medium
                            text-white
                          "
                        >
                          {profile.email}
                        </p>

                      </div>


                      {/* PHONE */}

                      <div
                        className="
                          grid
                          gap-3
                          border-b
                          border-white/8
                          py-4
                          sm:grid-cols-[170px_minmax(0,1fr)]
                          sm:items-center
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-medium
                            uppercase
                            tracking-wider
                            text-white/35
                          "
                        >
                          Phone Number
                        </p>


                        <p
                          className="
                            break-words
                            text-sm
                            font-medium
                            text-white
                          "
                        >

                          {profile.phone
                            || 'Not provided'}

                        </p>

                      </div>


                      {/* ACCOUNT STATUS */}

                      <div
                        className="
                          grid
                          gap-3
                          border-b
                          border-white/8
                          py-4
                          sm:grid-cols-[170px_minmax(0,1fr)]
                          sm:items-center
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-medium
                            uppercase
                            tracking-wider
                            text-white/35
                          "
                        >
                          Account Status
                        </p>


                        <div>

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

                      </div>


                      {/* MEMBER SINCE */}

                      <div
                        className="
                          grid
                          gap-3
                          py-4
                          sm:grid-cols-[170px_minmax(0,1fr)]
                          sm:items-center
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-medium
                            uppercase
                            tracking-wider
                            text-white/35
                          "
                        >
                          Member Since
                        </p>


                        <p
                          className="
                            text-sm
                            font-medium
                            text-white
                          "
                        >
                          {formatDate(
                            profile.created_at,
                          )}
                        </p>

                      </div>

                    </div>

                  )}

                </div>

              </div>

            </Card>

          ) : null}

        </main>


        {/* ==================================================
            FLOATING CHANGE PASSWORD MODAL
        ================================================== */}

        {passwordModalOpen && (

          <div
            className="
              fixed
              inset-0
              z-[100]
              flex
              items-center
              justify-center
              bg-black/75
              px-4
              py-8
              backdrop-blur-sm
            "

            onMouseDown={
              (event) => {

                if (
                  event.target ===
                  event.currentTarget
                ) {
                  closePasswordModal()
                }
              }
            }
          >

            <div
              className="
                w-full
                max-w-lg
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-surface
                shadow-2xl
                shadow-black/70
              "
            >

              {/* MODAL HEADER */}

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                  border-b
                  border-white/8
                  px-6
                  py-5
                "
              >

                <div>

                  <p
                    className="
                      mb-1
                      font-mono
                      text-[10px]
                      uppercase
                      tracking-[0.2em]
                      text-red
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
                      mt-1
                      text-xs
                      text-white/40
                    "
                  >
                    Enter your current
                    password before
                    creating a new one.
                  </p>

                </div>


                <button
                  type="button"

                  onClick={
                    closePasswordModal
                  }

                  disabled={
                    passwordSaving
                  }

                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-white/10
                    text-white/40
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >

                  <svg
                    className="
                      h-5
                      w-5
                    "

                    fill="none"

                    stroke="currentColor"

                    viewBox="0 0 24 24"
                  >

                    <path
                      strokeLinecap="round"

                      strokeLinejoin="round"

                      strokeWidth={1.8}

                      d="
                        M6 18
                        L18 6
                        M6 6
                        l12 12
                      "
                    />

                  </svg>

                </button>

              </div>


              {/* MODAL BODY */}

              <form
                onSubmit={
                  handlePasswordChange
                }

                className="
                  space-y-5
                  p-6
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


                {/* CURRENT PASSWORD */}

                <PasswordField
                  label="Current Password"

                  value={
                    currentPassword
                  }

                  onChange={
                    setCurrentPassword
                  }

                  visible={
                    showCurrentPassword
                  }

                  onToggleVisibility={() =>
                    setShowCurrentPassword(
                      (current) =>
                        !current,
                    )
                  }

                  autoComplete="
                    current-password
                  "
                />


                {/* NEW PASSWORD */}

                <PasswordField
                  label="New Password"

                  value={
                    newPassword
                  }

                  onChange={
                    setNewPassword
                  }

                  visible={
                    showNewPassword
                  }

                  onToggleVisibility={() =>
                    setShowNewPassword(
                      (current) =>
                        !current,
                    )
                  }

                  autoComplete="
                    new-password
                  "
                />


                {/* CONFIRM PASSWORD */}

                <PasswordField
                  label="
                    Confirm New Password
                  "

                  value={
                    confirmPassword
                  }

                  onChange={
                    setConfirmPassword
                  }

                  visible={
                    showConfirmPassword
                  }

                  onToggleVisibility={() =>
                    setShowConfirmPassword(
                      (current) =>
                        !current,
                    )
                  }

                  autoComplete="
                    new-password
                  "
                />


                <p
                  className="
                    text-xs
                    text-white/35
                  "
                >
                  Password must contain
                  at least 8 characters.
                </p>


                {/* MODAL BUTTONS */}

                <div
                  className="
                    flex
                    flex-col-reverse
                    gap-3
                    border-t
                    border-white/8
                    pt-5
                    sm:flex-row
                    sm:justify-end
                  "
                >

                  <Button
                    type="button"

                    variant="secondary"

                    onClick={
                      closePasswordModal
                    }

                    disabled={
                      passwordSaving
                    }
                  >
                    Cancel
                  </Button>


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

            </div>

          </div>

        )}

      </div>
    </>
  )
}


// ======================================================
// PASSWORD INPUT WITH EYE ICON
// ======================================================

interface PasswordFieldProps {
  label: string

  value: string

  onChange:
    (
      value: string,
    ) => void

  visible: boolean

  onToggleVisibility:
    () => void

  autoComplete?: string
}


function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div>

      <label
        className="
          mb-2
          block
          text-xs
          font-medium
          uppercase
          tracking-wider
          text-white/45
        "
      >
        {label}
      </label>


      <div className="relative">

        <input
          type={
            visible
              ? 'text'
              : 'password'
          }

          value={
            value
          }

          onChange={
            (event) =>
              onChange(
                event
                  .target
                  .value,
              )
          }

          autoComplete={
            autoComplete
          }

          required

          className="
            w-full
            rounded-lg
            border
            border-white/10
            bg-black/30
            px-4
            py-3
            pr-12
            text-sm
            text-white
            outline-none
            transition
            placeholder:text-white/20
            focus:border-red/50
            focus:ring-1
            focus:ring-red/25
          "
        />


        {/* EYE ICON */}

        <button
          type="button"

          onClick={
            onToggleVisibility
          }

          aria-label={
            visible
              ? `Hide ${label}`
              : `Show ${label}`
          }

          title={
            visible
              ? 'Hide password'
              : 'Show password'
          }

          className="
            absolute
            right-3
            top-1/2
            flex
            h-8
            w-8
            -translate-y-1/2
            items-center
            justify-center
            rounded-md
            text-white/35
            transition
            hover:bg-white/5
            hover:text-white
          "
        >

          {visible ? (

            /* EYE OFF */

            <svg
              className="
                h-5
                w-5
              "

              fill="none"

              stroke="currentColor"

              viewBox="0 0 24 24"
            >

              <path
                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.6}

                d="
                  M3 3
                  l18 18
                  M10.6 10.6
                  a2 2 0 002.8 2.8
                  M9.9 4.24
                  A10.94 10.94 0 0112 4
                  c5 0 9 4 10 8
                  a11.4 11.4 0 01-2.3 4.2
                  M6.6 6.6
                  A11.2 11.2 0 002 12
                  c1 4 5 8 10 8
                  a10.8 10.8 0 004.1-.8
                "
              />

            </svg>

          ) : (

            /* EYE */

            <svg
              className="
                h-5
                w-5
              "

              fill="none"

              stroke="currentColor"

              viewBox="0 0 24 24"
            >

              <path
                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.6}

                d="
                  M2 12
                  s3.5-7
                  10-7
                  10 7
                  10 7
                  -3.5 7
                  -10 7
                  S2 12
                  2 12z
                "
              />


              <circle
                cx="12"
                cy="12"
                r="3"

                strokeWidth={1.6}
              />

            </svg>

          )}

        </button>

      </div>

    </div>
  )
}