# Dearo iOS visual and interaction direction

Reviewed 24 October 2026. The original white/near-black/cobalt identity remains.
References inform hierarchy and interaction, not copied artwork or claims of
native-device verification.

## Inspected public references
- Dribbble Roommates to-do concept: https://dribbble.com/shots/19695156-To-Do-List-Roommates-App
- Dribbble invoice-detail concept: https://dribbble.com/shots/20350438-Mobile-tool-for-paying-invoices
- Things official product screenshots/features: https://culturedcode.com/things/features/
- Apple Invites product announcement/guest-list imagery: https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/
- Apple button guidance: https://developer.apple.com/design/human-interface-guidelines/buttons

Dribbble examples are visual concepts, not usability evidence. Things and Apple
Invites provide real-product references for quiet hierarchy, list scanning and
contextual actions. No illustration, icon, image or branded layout was copied.

## Applied to Dearo
1. Compact local event summary replaces the tall decorative invitation card;
   editing fields appear earlier. No remote invitation artwork is fetched.
2. Settings uses grouped disclosure/action rows, a real native haptics switch,
   neutral backup actions and a separated red-text clear action.
3. The send screen prioritizes recipient identity and number. The fixed primary
   action remains explicit manual confirmation; retry is visible and copy
   controls are compact. No visual polish changes sending semantics.
4. Guest list rows emphasize name/phone; empty search has its own recovery copy.
   Import and review lists are virtualized, with tests limiting initial rows for
   5,000 synthetic entries.
5. First-screen brand is static, not a no-op Back control. Pending Back is
   explicitly disabled. Primary actions retain 54-point minimum height; compact
   actions target at least 44 points with feedback. Headings soften to 700 weight,
   meaningful captions use 13 points and text remains scalable.

## Not added
No dashboard tabs, decorative wedding assets, translucent imitation system UI,
photo collection, RSVP service, new permissions, network analytics or animation
that slows the manual invitation workflow.

## Acceptance boundary
Rendered tests cover state and interactions, not pixel-perfect native output.
Final typography, VoiceOver focus, largest Dynamic Type sizes, small-screen
keyboard layout, press feedback and physical-device WhatsApp switching still
require a compiled iPhone build and device review before release.
