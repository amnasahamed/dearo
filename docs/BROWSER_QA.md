# Browser visual QA — 2026-10-24

Supplementary visual QA of the **actual app UI**, not screenshot mockups, a PWA product or an iOS emulator. A local React Native Web harness imports production UI components and substitutes only native boundaries. No public deployment, real personal data or external messages were used.

## Exercised in cloud Chrome

- Optional onboarding renders with the complete Continue action in a 390×568 CSS frame.
- Invitation form saves and proceeds to Guests. Visual inspection found its continuation below the scrollable form. Fixed the production UI: the scrollable form now has a separate keyboard-aware action footer, matching the other primary screens. Added a rendered save regression.
- Guest list shows names, canonical numbers, user-confirmed statuses and fixed Start inviting action.
- Open WhatsApp first shows the account notice through an explicit HTML stand-in for native Alert. The mocked handoff leaves the count at 2/6, awaiting explicit confirmation.
- One Sent, next guest tap confirms Jordan and opens the next mock handoff for Morgan; count becomes 3/6, not automatically confirmed.
- Settings shows grouped rows and the switch. Contact/share/StoreKit/clipboard interactions are mocked, not native acceptance.
- At 320×568, invalid phone remains in the manual-entry sheet with visible error and Save action. Correcting it to a fictitious NANP number saves successfully, also exercised in a reduced-height 390×420 frame.
- Completed fixture shows 6/6 and explicitly distinguishes user confirmations from delivery receipts.

## Screenshot inventory

Unedited browser captures were delivered separately, with a visible “Browser visual QA” header, synthetic native-adapter notice and dimensions. Use the complete/fixed captures rather than the earlier viewport-cropped drafts:

1. `01-onboarding-complete.jpg`
2. `02-invitation-fixed-footer.jpg`
3. `03-guests.jpg`
4. `04-send.jpg`
5. `05-confirm.jpg`
6. `06-settings.jpg`
7. `07-narrow-validation.jpg`
8. `08-summary.jpg`

## Limitations

CSS frames are not iPhone emulation. Browser font metrics, native sheets/switches, safe areas, VoiceOver, Dynamic Type, keyboard avoidance, OS permission dialogs, persistence/relaunch, WhatsApp return lifecycle and StoreKit still need macOS simulator/physical-device acceptance. Reduced height is not a real keyboard test. Browser full-page capture timed out; complete compact frames were captured directly, without image editing/compositing. Native BackHandler is explicitly a no-op in this web-only harness. See `preview/README.md` to reproduce.
