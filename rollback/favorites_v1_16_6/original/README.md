# HEWRS connected candidate — V1.16.5

Continue using the existing 18 connected shirts in blazer and shirt-only modes.
The other 32 shirts are deferred for these modes, not release blockers, not
removed from inventory, and not removed from suit mode. All 50 shirts remain
in Wardrobe and in the existing 18-suit routes.

Serve this COMPLETE folder as a static website with index.html at its root.
Keep the existing candidate repository/origin and its browser storage. There is
no need to create a new repository, clear localStorage, or migrate wear history.
Do not overwrite the separate legacy live application.

The non-suit Shirt picker now lists only its 18 usable shirts in their existing
relative order. Its brand filter uses the same visible set. Switching from a
suit keeps the previously selected shirt without substituting another; a
non-suit-ineligible draft cannot be applied. Cancel preserves preferences.
The accepted mobile sheet layout, palette and garment output are unchanged.

RELEASE_SCOPE.json records the owner's instruction and the separately labelled
owner-reported V1.16.4 mobile-picker/persistence acceptance for DS023 + T017.
These recorded passes are not fresh tool-observed device testing of V1.16.5.
The 32-shirt source search is deferred; no additional source uploads or garment
approvals are required for this 18-shirt scope.

Read DELIVERY_V1_16_5.md for changes, evidence and material limits.
Verify with `python -B tools/verify_v1165.py`.
Restore exact V1.16.4 into a NEW folder with
`python -B tools/rollback_v1165.py --output NEW_FOLDER`.
Neither command accesses browser data or GitHub.

Shirt-only remains an exact manual Anchor workflow, with no fabricated
numerical ranking. Existing source-score holds remain. Watch ID/name is
sufficient; watch images and other previously unavailable functions are not
silently presented as implemented.
