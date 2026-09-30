# V1.23.0 — install and use saved Both/Neither answers

The cumulative update supports the exact delivered V1.22.0 or V1.22.1 source.
It includes the existing fast-start optimization when starting from V1.22.0.

1. Extract the update. Copy the CONTENTS of `FILES_TO_COPY` into your existing
   candidate repository root, replacing matching files. Keep all other files and
   `.git`. Do not copy the enclosing folder, review images or ZIP into the web root.
2. Commit and push using:
   `V1.23.0 — learn Both/Neither separately and add targeted comparisons`
3. Reopen the same website in the SAME browser that contains your feedback.
   Do not clear website storage or re-import an old backup to refresh it.
4. Open **Outfits → Outfit preferences**. The panel shows **A/B preference ranking**
   and **Outfit acceptability** separately. Your existing answers are read as saved;
   no repeat of the 24-pair exercise is required.
5. In **Research-based wardrobe generator — local (up to 20)**, generate a NEW list.
   With active acceptability only, cards show **Local preference fit · learned
   acceptability**. A previous generated list is not evidence of the new adjustment.

The existing A/B threshold is unchanged. Enough balanced Both/Neither evidence may
activate acceptability while A/B ranking remains inactive. An inactive channel's
reason is shown. Neither activation nor a small held-out test proves good styling.

**New shirt & complete-outfit comparisons** opens 12 additional unlabelled pairs,
not the old pilot: six shirt comparisons and six full-look comparisons. Honest
Both/Neither answers remain valid. Four pairs are reserved checks and never fitted.
Pause/Resume, Undo last and separate Export/Import remain available.

Your feedback remains local to each browser. On another device, use its existing
preference import preview/merge only to transfer your own separate preference
export. Do not import synthetic test fixtures, audit reports or a model JSON.

No private website, model API, paid service or credential is required. This package
was not pushed to GitHub by its author. Keep personal exports outside the public repo.

Verification: `python -B tools/verify_v1230.py`
Rollback: `python -B tools/rollback_v1230.py --output NEW_FOLDER`
Rollback reconstructs exact V1.22.1 in a new folder and never touches browser data.
V1.22.1 can read all saved response rows but will again ignore Both/Neither during
fitting. The new follow-up bank is not shown by that older UI.
