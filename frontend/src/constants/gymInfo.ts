export interface OperatingHoursEntry {
  days: string
  hours: string
}

/**
 * Verified business identity, address, contact details, and operating schedule
 * sourced from TDGGYM-QUESTIONNAIRES-1 (The DGym Rosario, Batangas).
 */
export const GYM_INFO = {
  name: 'The DGym Rosario Batangas',
  shortName: 'The DGym',
  tagline:
    'Top-Tier Strength & Cardio Equipment + 1-on-1 Personal Training with Elite Certified Coaches',
  seoDescription:
    'High End Premium Weightlifting, Powerlifting, and Fitness Gym at 2nd Floor, Carandang St., Brgy. Namuco, Rosario, Batangas.',
  streetAddress: '2nd Floor, Carandang St., Brgy. Namuco, Rosario, Batangas',
  landmark: 'Along the Highway — In front of Shell Gasoline Station',
  fullAddress:
    '2nd Floor, Carandang St., Brgy. Namuco, Rosario, Batangas (Along the Highway — In front of Shell Gasoline Station)',
  cityRegion: 'Rosario, Batangas, Philippines',
  phoneDisplay: '0969 483 9896',
  phoneInternational: '+63 969 483 9896',
  phoneHref: 'tel:+639694839896',
  email: 'tdgymcustomerservice.825@gmail.com',
  emailHref: 'mailto:tdgymcustomerservice.825@gmail.com',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61577169056417',
  facebookLabel: 'The DGym Rosario Batangas',
  operatingHours: [
    { days: 'Monday – Friday', hours: '6:00 AM – 11:00 PM' },
    { days: 'Saturday', hours: '6:00 AM – 11:00 PM' },
    { days: 'Sunday', hours: '2:00 PM – 10:00 PM' },
    { days: 'Holidays', hours: 'Depends on Holiday' },
  ] as readonly OperatingHoursEntry[],
  operatingHoursSummary:
    'Mon–Sat: 6:00 AM – 11:00 PM • Sun: 2:00 PM – 10:00 PM • Holidays: Depends on Holiday',
} as const
