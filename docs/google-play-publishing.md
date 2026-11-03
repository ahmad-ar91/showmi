# Publish to Google Play

ShowMi can send a generated listing straight to Google Play Console: the title, short and full description, phone screenshots and feature graphic for every language you generated. It uses the Google Play Developer API, the same edit workflow `fastlane supply` uses.

**This is optional.** Without the settings below, ShowMi runs exactly as before: audit, localize, preview and the Fastlane ZIP all work, and the Publish panel only says that publishing is not set up.

## Contents

- [What you need](#what-you-need)
- [1. Enable the API in Google Cloud](#1-enable-the-api-in-google-cloud)
- [2. Create a service account and a key](#2-create-a-service-account-and-a-key)
- [3. Give the service account access in Play Console](#3-give-the-service-account-access-in-play-console)
- [4. Configure ShowMi](#4-configure-showmi)
- [5. Check, then publish](#5-check-then-publish)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Turning it off](#turning-it-off)

## What you need

- A Google Play developer account with the **Owner** or **Admin** role, so you can invite users.
- An app that **already exists** in Play Console. The API edits listings; it cannot create apps.
- A Google Cloud project. Any project works, and the API is free to use.

Google renames console menus from time to time. If a label below does not match exactly, look for the closest equivalent.

## 1. Enable the API in Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select a project, or create one (for example `showmi-publishing`).
2. Go to **APIs & Services → Library**.
3. Search for **Google Play Android Developer API**, open it and press **Enable**.

## 2. Create a service account and a key

A service account is a robot Google account. ShowMi signs in as it, so you never share your own password.

1. In the same project, go to **IAM & Admin → Service Accounts** and press **Create service account**.
2. Give it a name such as `showmi-publisher`, then press **Create and continue**. It needs **no** Google Cloud roles, so skip the role step and press **Done**.
3. Open the new service account, go to the **Keys** tab, choose **Add key → Create new key → JSON**, and press **Create**. A `.json` file downloads.
4. Copy the service account's email address (it ends in `.iam.gserviceaccount.com`). You need it in the next step.

Keep the JSON file **outside** the ShowMi folder, for example `C:\keys\showmi-publisher.json` or `~/keys/showmi-publisher.json`. It works like a password.

> If key creation is blocked, your Google Cloud organization has a policy that disables service account keys (`iam.disableServiceAccountKeyCreation`). Use a personal project, or ask your organization admin.

## 3. Give the service account access in Play Console

1. Open [Google Play Console](https://play.google.com/console/) and go to **Users and permissions**.
2. Press **Invite new users** and paste the service account's email.
3. Under **App permissions**, add the app (or apps) ShowMi may edit.
4. For each app, grant the permission to edit the store listing. In the Store presence group it is called something like **Edit store listing, pricing & distribution**. Nothing else is needed: no release, financial or user-management permissions.
5. Press **Invite user**. There is no email to accept; service accounts are active immediately.

New permissions can take a while to reach the API, sometimes up to a day. If the check in step 5 says the caller does not have permission, wait and try again.

## 4. Configure ShowMi

Add three settings. Leave any you do not use empty.

| Setting | Value |
| --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` | Path to the JSON key. Use this when running ShowMi on your own computer. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The whole content of the JSON key. Use this on a host such as Vercel, where there is no file to point to. |
| `GOOGLE_PLAY_PACKAGES` | Comma-separated package names ShowMi may edit, for example `com.yourcompany.app,com.yourcompany.other`. ShowMi refuses every other app. |

**On your computer**, add them to `.env.local` (never to `.env.example`) and restart the app:

```bash
GOOGLE_PLAY_SERVICE_ACCOUNT_FILE=C:/keys/showmi-publisher.json
GOOGLE_PLAY_PACKAGES=com.yourcompany.app
```

**On Vercel**, open the project's **Settings → Environment Variables**, add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` with the full JSON as its value and `GOOGLE_PLAY_PACKAGES`, then redeploy.

To confirm the setup, open `/api/play` on your ShowMi URL (for example `http://localhost:3000/api/play`). It should show `"configured": true`, the service account email and your packages. It never shows the key.

## 5. Check, then publish

1. Audit your app, press **Fix and localize**, and generate a listing as usual.
2. Open **Preview and export** and scroll to **Publish to Google Play**.
3. Pick the app and press **Check with Google Play**. ShowMi opens a draft (an *edit*) on Google Play, uploads the text and images for every generated language, asks Google to validate it, and then **discards the draft**. Nothing changes on your listing.
4. If the check passes, **Publish** becomes available. It sends the same content again and commits it. Google reviews store listing changes before they go live, which can take from minutes to days.

What publishing changes, for each generated language:

- Title, short description and full description are replaced.
- **All** existing phone screenshots are replaced by ShowMi's posters, in order.
- The feature graphic is replaced.

Languages you did not generate, and everything else in Play Console (icon, video, tablet screenshots, releases, pricing), stay as they are. If any step fails, ShowMi discards the draft, so a failed run never leaves half a listing behind.

## Troubleshooting

The Publish panel shows Google's own message. Typical ones:

| Message | Cause and fix |
| --- | --- |
| Publishing is not set up on this server | No key or no `GOOGLE_PLAY_PACKAGES`. Check step 4 and restart the app. |
| … is not in GOOGLE_PLAY_PACKAGES | Add the package name to `GOOGLE_PLAY_PACKAGES`, separated by commas. |
| GOOGLE_PLAY_SERVICE_ACCOUNT_FILE points to a file that cannot be read | Wrong path, or the app cannot read that folder. Use an absolute path. |
| … is not a valid service account JSON file | The file or variable is not the downloaded key, or the JSON was cut off when pasted. |
| Google sign-in for the service account failed: Invalid grant | The key was deleted, belongs to a deleted account, or your computer clock is far off. Create a new key. |
| Google Play Android Developer API has not been used in project … or it is disabled | Step 1 was done in a different project than the service account's. Enable the API in the service account's project. |
| The caller does not have permission | The service account is not invited for this app, lacks the store listing permission, or the permission has not reached the API yet (see step 3). |
| Package not found | The package name is wrong, or the app does not exist in this Play Console account. |
| Changes cannot be sent for review automatically | Your app uses managed publishing or has a pending issue in Play Console. Resolve it in Play Console, or publish the review from there. |
| An image error (size, format, count) | Google limits screenshots per language (2 to 8 phone screenshots). Generate with 2 or more screenshots and no more than 8. |

## Security

- The key gives control over the store listings of the apps you granted. Treat it like a password. Never commit it, paste it in chats or issues, or put it in a URL. The repository's `.gitignore` ignores `.env*` files and the `secrets/` folder, but the safest place for the key is outside the project folder.
- Anyone who can open a ShowMi deployment that has a key configured can press Publish for the listed packages. Only configure publishing on a deployment that you alone can reach, such as your own computer or a password-protected deployment.
- Grant only the store listing permission and only for the apps you need, and keep `GOOGLE_PLAY_PACKAGES` to the same list.

## Turning it off

- In ShowMi: remove the three settings and restart. The Publish panel goes back to "not set up" and everything else keeps working.
- To revoke access completely: in Play Console, remove the service account under **Users and permissions**, and in Google Cloud, delete the key (or the whole service account) under **IAM & Admin → Service Accounts**.
