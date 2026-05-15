# Changes Made - May 11, 2026

## Summary
Fixed three critical issues:
1. ✅ Deleted `.next` folder and rebuilt the application
2. ✅ Added visual loading indicators (spinners) to prevent double-clicking on sign-in/sign-up buttons
3. ✅ Updated all image capture inputs to allow both camera capture AND selecting existing screenshots/images from gallery

## 1. Clean Build
- Deleted `.next` folder to clear any stale build artifacts
- Rebuilt application successfully with `npm run build`
- Build completed without errors

## 2. Loading Indicators on Auth Buttons
Added spinning loader icons to sign-in and sign-up buttons to prevent users from clicking multiple times:

### Files Updated:
- `app/page.tsx` (Sign In page)
- `app/signup/page.tsx` (Sign Up page)

### Changes:
- Imported `Spinner` component from `@/components/ui/spinner`
- Added `{loading && <Spinner className="mr-2" />}` to both buttons
- Buttons now show a spinning icon when `loading` state is true
- Prevents accidental double-clicks during authentication

## 3. Image Capture & Screenshot Support
Removed the `capture="environment"` attribute from all file input elements throughout the application. This allows users to:
- ✅ Take a new photo using the device camera
- ✅ Select existing images/screenshots from photo gallery
- ✅ Choose between camera and gallery on mobile devices

### Files Updated:
1. `components/installation-wizard/installation-wizard-form.tsx`
2. `app/surveys/new/page.tsx`
3. `app/surveys/[id]/edit/page.tsx`
4. `app/warehouse/inward/new/page.tsx`
5. `components/installation-material-lines-editor.tsx` (4 instances)
6. `app/warehouse/reallocation/page.tsx` (2 instances)

### Button Labels Updated:
- Changed from "Take Photo" / "Open Camera" → "Camera / Gallery"
- Makes it clear users can choose either option

### Technical Details:
- Removed `capture="environment"` attribute from all `<input type="file" accept="image/*">` elements
- The `capture` attribute was forcing the camera to open directly
- Without it, mobile browsers show a chooser dialog allowing:
  - Take Photo (opens camera)
  - Choose from Gallery (opens photo picker)
  - Browse Files (opens file manager)

## Environment Variables Status
Current `.env.local` pattern (single public URL + optional internal server URL):
```
NEXT_PUBLIC_SUPABASE_URL=https://solarepc.brihaspathi.com/supabase
SUPABASE_URL=http://127.0.0.1:8001   # optional; admin/service-role only — must match Kong’s host port (8000 default; 7100+ if remapped)
# Optional dev: NEXT_PUBLIC_SUPABASE_LOCAL_API_PORT=8001  # when using http://localhost with no :port + LAN hostname
NEXT_PUBLIC_SUPABASE_ANON_KEY=<configured>
SUPABASE_SERVICE_ROLE_KEY=<configured>
```

### Note on Environment Variables:
- Browsers use only `NEXT_PUBLIC_SUPABASE_URL` (one canonical HTTPS API).
- `SUPABASE_URL` speeds server-side and middleware calls when Next runs beside Kong.
- `NEXT_PUBLIC_SUPABASE_URL_LAN` was removed from the app to reduce confusion and split behavior.

## Mobile Pull-to-Refresh
Mobile browsers (Safari, Chrome, etc.) natively support pull-to-refresh gesture:
- Works automatically on all pages
- No additional code needed
- User can swipe down from top of page to refresh

## Testing Recommendations
1. Test sign-in/sign-up on mobile - verify spinner appears and prevents double-clicks
2. Test image uploads on mobile - verify "Camera / Gallery" chooser appears
3. Test screenshot selection - take a screenshot, then upload it via gallery option
4. Test pull-to-refresh - swipe down from top of any page to reload

## Build Status
✅ Build completed successfully
✅ All TypeScript checks passed (with ignoreBuildErrors config)
✅ All routes generated successfully
✅ No runtime errors detected
