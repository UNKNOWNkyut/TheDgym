import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useLocation,
} from 'react-router-dom'

import {
  Badge,
} from '@/components/ui/Badge'

import {
  accountApi,
} from '@/services/accountApi'

import type {
  AccountProfile,
} from '@/types/account'

import type {
  User,
} from '@/types/auth'


interface MemberAccountMenuProps {
  user: User

  onLogout:
    () => Promise<void>
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


export function MemberAccountMenu({
  user,
  onLogout,
}: MemberAccountMenuProps) {
  const location =
    useLocation()


  const menuRef =
    useRef<
      HTMLDivElement | null
    >(null)


  const [
    open,
    setOpen,
  ] =
    useState(false)


  const [
    profile,
    setProfile,
  ] =
    useState<
      AccountProfile | null
    >(null)


  // ======================================================
  // LOAD MEMBER PROFILE
  // ======================================================

  useEffect(() => {
    let active = true


    async function loadProfile() {
      try {
        const data =
          await accountApi
            .getProfile()


        if (active) {
          setProfile(data)
        }

      } catch {

        if (active) {
          setProfile(null)
        }
      }
    }


    loadProfile()


    return () => {
      active = false
    }

  }, [
    location.pathname,
  ])


  // ======================================================
  // REFRESH SIDEBAR PROFILE
  // ======================================================

  useEffect(() => {

    const refreshProfile =
      () => {

        accountApi
          .getProfile()
          .then(
            setProfile,
          )
          .catch(
            () =>
              setProfile(null),
          )
      }


    window.addEventListener(
      'dgym-profile-picture-updated',
      refreshProfile,
    )


    window.addEventListener(
      'dgym-profile-updated',
      refreshProfile,
    )


    return () => {

      window.removeEventListener(
        'dgym-profile-picture-updated',
        refreshProfile,
      )


      window.removeEventListener(
        'dgym-profile-updated',
        refreshProfile,
      )
    }

  }, [])


  // ======================================================
  // CLOSE MENU WHEN CLICKING OUTSIDE
  // ======================================================

  useEffect(() => {

    const handleOutsideClick =
      (
        event: MouseEvent,
      ) => {

        if (
          menuRef.current &&
          !menuRef.current.contains(
            event.target as Node,
          )
        ) {
          setOpen(false)
        }
      }


    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    )


    return () => {

      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      )
    }

  }, [])


  const displayName =
    profile?.full_name
    ?? user.full_name


  const pictureUrl =
    profile
      ?.profile_picture_url
    ?? null


  return (
    <div
      ref={menuRef}

      className="
        relative
        p-4
        border-t
        border-white/8
        bg-surface-2/40
      "
    >

      {/* ==================================================
          SETTINGS DROPDOWN
      ================================================== */}

      {open && (

        <div
          className="
            absolute
            bottom-[calc(100%-8px)]
            left-4
            right-4
            z-20
            overflow-hidden
            rounded-xl
            border
            border-white/10
            bg-surface
            shadow-2xl
            shadow-black/50
          "
        >

          <div
            className="
              border-b
              border-white/8
              px-3
              py-2.5
            "
          >

            <p
              className="
                text-[10px]
                uppercase
                tracking-widest
                text-white/30
                font-mono
              "
            >
              Member Menu
            </p>

          </div>


          {/* ACCOUNT SETTINGS */}

          <Link
            to="/settings"

            onClick={() =>
              setOpen(false)
            }

            className="
              flex
              items-center
              gap-3
              px-3
              py-3
              text-sm
              text-white/65
              transition
              hover:bg-white/5
              hover:text-white
            "
          >

            <svg
              className="
                h-4
                w-4
                text-white/40
              "

              fill="none"

              stroke="currentColor"

              viewBox="0 0 24 24"
            >

              <path
                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.5}

                d="
                  M10.325 4.317
                  c.426-1.756
                  2.924-1.756
                  3.35 0
                  a1.724 1.724 0 002.573 1.066
                  c1.543-.94 3.31.826 2.37 2.37
                  a1.724 1.724 0 001.065 2.572
                  c1.756.426 1.756 2.924 0 3.35
                  a1.724 1.724 0 00-1.066 2.573
                  c.94 1.543-.826 3.31-2.37 2.37
                  a1.724 1.724 0 00-2.572 1.065
                  c-.426 1.756-2.924 1.756-3.35 0
                  a1.724 1.724 0 00-2.573-1.066
                  c-1.543.94-3.31-.826-2.37-2.37
                  a1.724 1.724 0 00-1.065-2.572
                  c-1.756-.426-1.756-2.924 0-3.35
                  a1.724 1.724 0 001.066-2.573
                  c-.94-1.543.826-3.31 2.37-2.37
                  .996.608
                  2.296.07
                  2.572-1.065z
                "
              />


              <path
                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.5}

                d="
                  M15 12
                  a3 3 0 11-6 0
                  3 3 0 016 0z
                "
              />

            </svg>


            <span className="flex-1">
              Account Settings
            </span>


            <span className="text-white/25">
              →
            </span>

          </Link>


          {/* SIGN OUT */}

          <button
            type="button"

            onClick={
              async () => {

                setOpen(false)

                await onLogout()
              }
            }

            className="
              flex
              w-full
              items-center
              gap-3
              border-t
              border-white/8
              px-3
              py-3
              text-left
              text-sm
              text-white/60
              transition
              hover:bg-danger/10
              hover:text-danger
            "
          >

            <svg
              className="h-4 w-4"

              fill="none"

              stroke="currentColor"

              viewBox="0 0 24 24"
            >

              <path
                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.5}

                d="
                  M17 16l4-4
                  m0 0l-4-4
                  m4 4H7
                  m6 4v1
                  a3 3 0 01-3 3H6
                  a3 3 0 01-3-3V7
                  a3 3 0 013-3h4
                  a3 3 0 013 3v1
                "
              />

            </svg>


            Sign Out

          </button>

        </div>
      )}


      {/* ==================================================
          MEMBER DISPLAY
      ================================================== */}

      <div
        className="
          flex
          items-center
          gap-3
        "
      >

        {/* AVATAR */}

        <div
          className="
            h-10
            w-10
            shrink-0
            overflow-hidden
            rounded-full
            border
            border-white/10
            bg-red
            text-white
            shadow-sm
          "
        >

          {pictureUrl ? (

            <img
              src={pictureUrl}

              alt={
                `${displayName} profile`
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
                text-xs
                font-bold
                uppercase
              "
            >

              {getInitials(
                displayName,
              )}

            </div>
          )}

        </div>


        {/* NAME + SETTINGS */}

        <div
          className="
            min-w-0
            flex-1
          "
        >

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <p
              className="
                min-w-0
                flex-1
                truncate
                text-sm
                font-semibold
                leading-tight
                text-white
              "
            >

              {displayName}

            </p>


            {/* GEAR ICON */}

            <button
              type="button"

              aria-label="
                Open member settings menu
              "

              aria-expanded={
                open
              }

              onClick={() =>
                setOpen(
                  (current) =>
                    !current,
                )
              }

              className={`
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                border
                transition

                ${
                  open
                    ? `
                      border-red/30
                      bg-red/10
                      text-red
                    `
                    : `
                      border-white/8
                      text-white/35
                      hover:border-white/15
                      hover:bg-white/5
                      hover:text-white
                    `
                }
              `}
            >

              <svg
                className="h-4 w-4"

                fill="none"

                stroke="currentColor"

                viewBox="0 0 24 24"
              >

                <path
                  strokeLinecap="round"

                  strokeLinejoin="round"

                  strokeWidth={1.5}

                  d="
                    M10.325 4.317
                    c.426-1.756
                    2.924-1.756
                    3.35 0
                    a1.724 1.724 0 002.573 1.066
                    c1.543-.94 3.31.826 2.37 2.37
                    a1.724 1.724 0 001.065 2.572
                    c1.756.426 1.756 2.924 0 3.35
                    a1.724 1.724 0 00-1.066 2.573
                    c.94 1.543-.826 3.31-2.37 2.37
                    a1.724 1.724 0 00-2.572 1.065
                    c-.426 1.756-2.924 1.756-3.35 0
                    a1.724 1.724 0 00-2.573-1.066
                    c-1.543.94-3.31-.826-2.37-2.37
                    a1.724 1.724 0 00-1.065-2.572
                    c-1.756-.426-1.756-2.924 0-3.35
                    a1.724 1.724 0 001.066-2.573
                    c-.94-1.543.826-3.31 2.37-2.37
                    .996.608
                    2.296.07
                    2.572-1.065z
                  "
                />


                <path
                  strokeLinecap="round"

                  strokeLinejoin="round"

                  strokeWidth={1.5}

                  d="
                    M15 12
                    a3 3 0 11-6 0
                    3 3 0 016 0z
                  "
                />

              </svg>

            </button>

          </div>


          <div className="mt-1">

            <Badge
              variant="success"
            >
              member
            </Badge>

          </div>

        </div>

      </div>

    </div>
  )
}