/**
 * Demo people: the optional cast pre-enrolled with synthetic templates so a
 * single presenter can play several people. Only loaded while the "Demo
 * people" setting is on; real enrollments are never mixed up with them.
 */
import type { DemoIdentitySeed } from '../core/identity/IdentityService'

export interface DemoPersona extends DemoIdentitySeed {
  key: string
  context: string
  featured?: boolean
}

const p = (
  key: string,
  name: string,
  email: string,
  origin: 'office' | 'hotel' | 'demo',
  context: string,
  featured = false,
): DemoPersona => ({ key, identityId: `idn_demo_${key}`, seed: `persona:${key}`, name, email, origin, context, featured })

/** The full demo cast. Load it through setDemoPeople(), never directly. */
export const DEMO_PERSONAS: DemoPersona[] = [
  p('sarah', 'Sarah Chen', 'sarah.chen@meridian.co', 'office', 'Employee · Engineering', true),
  p('emma', 'Emma Johnson', 'emma.johnson@gmail.com', 'hotel', 'Hotel guest · Room 814', true),
  p('michael', 'Michael Patel', 'michael.patel@meridian.co', 'office', 'Employee · Infrastructure'),
  p('priya', 'Priya Raman', 'priya.raman@meridian.co', 'office', 'Executive · COO'),
  p('david', 'David Kim', 'david.kim@acme.com', 'office', 'Visitor · Acme'),
  p('daniel', 'Daniel Reyes', 'd.reyes@outlook.com', 'hotel', 'Hotel guest · checked out'),
  p('marcus', 'Marcus Webb', 'marcus.webb@icloud.com', 'hotel', 'Hotel guest · Room 802'),
  p('olivia', 'Olivia Martinez', 'olivia.martinez@meridian.co', 'office', 'Employee · Design'),
  p('lucas', 'Lucas Moreau', 'lucas.moreau@meridian.co', 'office', 'Employee · Engineering'),
  p('grace', 'Grace Liu', 'grace.liu@meridian.co', 'office', 'Employee · Engineering'),
  p('daniel-o', 'Daniel Okafor', 'daniel.okafor@meridian.co', 'office', 'Employee · Sales'),
  p('hannah', 'Hannah Schmidt', 'hannah.schmidt@meridian.co', 'office', 'Employee · People'),
  p('tom', 'Tom Becker', 'tom.becker@meridian.co', 'office', 'Employee · Facilities'),
  p('ryan', 'Ryan Brooks', 'ryan.brooks@meridian.co', 'office', 'Employee · IT'),
  p('noah-f', 'Noah Fischer', 'noah.fischer@meridian.co', 'office', 'Employee · suspended'),
  p('chloe', 'Chloe Dubois', 'chloe.dubois@gmail.com', 'hotel', 'Hotel guest · Suite 819'),
  p('kenji', 'Kenji Tanaka', 'kenji.tanaka@gmail.com', 'hotel', 'Hotel guest · Room 809'),
  p('sofia', 'Sofia Alvarez', 'sofia.alvarez@gmail.com', 'hotel', 'Hotel guest · Room 805'),
  p('maya', 'Maya Chen', 'maya@chenfamily.home', 'demo', 'Family · kid, 9'),
  p('leo', 'Leo Chen', 'leo@chenfamily.home', 'demo', 'Family · kid, 13'),
]

export const personaById = (key: string) => DEMO_PERSONAS.find((x) => x.key === key)
export const personaIdentity = (key: string) => `idn_demo_${key}`

/** Seed used for the "Unknown Person" demo subject; fresh every attempt so it never matches. */
export const unknownSeed = () => `unknown:${crypto.randomUUID()}`
