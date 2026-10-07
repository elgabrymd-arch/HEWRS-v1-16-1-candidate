B15 registration uses the new owner photograph for cloth RGB; no old blazer cloth is reused.
The preserved B01 garment-only alpha and existing ownership map establish frame placement only.
The worn projection is approximate and is not a new owner-approved front photograph.
Reproducer: python tools/rebuild_b15_registration.py --output NEW_FOLDER
Requires Pillow, NumPy, scipy and OpenCV. The app does not require these packages.
The retail hanging label is omitted from the worn sampling field using adjacent source cloth; the original is preserved byte-for-byte.
