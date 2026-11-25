# Installing Compress Studio

Compress Studio makes images, videos and GIFs smaller. It runs entirely on your Mac and nothing is uploaded. Setup takes about two minutes, and you don't need to install anything else.

## Before you start

You need:

- **A Mac with Apple silicon** (M1 or newer). To check, open the Apple menu  → **About This Mac** and look for **Chip: Apple M…**
- **macOS 12 Monterey or newer**
- The file **Compress Studio-1.0.0-arm64.dmg**, which you'll have been sent

## 1. Install the app

1. Double-click the **.dmg** file you were sent. A window opens.
2. Drag the **Compress Studio** icon onto the **Applications** folder.
3. Close the window. In Finder's sidebar, click the eject button next to **Compress Studio** to put the installer away. You can delete the .dmg file afterwards.

## 2. Open it for the first time

Compress Studio is an internal tool, so it isn't on the App Store and Apple hasn't reviewed it. macOS asks you to approve apps like this **once**. Here's how:

1. Open **Applications** and double-click **Compress Studio**.
2. macOS says it **can't verify** the app (the wording is something like *“Apple could not verify ‘Compress Studio’ is free of malware…”*). That's expected. Click **Done**. Don't click **Move to Bin**.
3. Open the Apple menu  → **System Settings** → **Privacy & Security**.
4. Scroll down to the **Security** section. You'll see *“Compress Studio” was blocked to protect your Mac.* Click **Open Anyway**.
   - The button only shows for about an hour after step 2. If you don't see it, do step 1 again.
5. Confirm with your password or Touch ID, then click **Open Anyway** once more if asked.

The app opens, and from now on it opens normally like any other app. You can also keep it in your Dock: right-click its icon while it's open → **Options** → **Keep in Dock**.

> **Why does this happen?** Apple shows this warning for any app that wasn't sent to Apple for checking. It's normal for internal tools, and you only approve it once per version.

## 3. Allow access to your folders

The first time you add files from **Desktop**, **Documents** or **Downloads**, macOS asks:

> *“Compress Studio” would like to access files in your Desktop folder.*

Click **Allow**. The app needs this to read your files and save the smaller copies next to them. It never changes or deletes your originals.

**Clicked “Don't Allow” by mistake?** Open  → **System Settings** → **Privacy & Security** → **Files & Folders** → **Compress Studio**, and switch on the folders you need. The app's Help panel (the **?** button) has a shortcut straight to that page.

## Using it

When the app first opens, it shows a short welcome and offers a tour. In short:

1. Choose **Images**, **Videos** or **GIFs** on the left.
2. Drag in files or a folder.
3. Pick a preset (choose **Recommended** if you're not sure) and press **Start**.

Your new files go into a folder called **Outputs …** next to your originals, for example `Outputs img-webp`. Click **Show in Finder** when it's done.

You can replay the tour any time from the **?** button in the bottom-right corner.

## Updating to a new version

1. Quit Compress Studio.
2. Open the new .dmg and drag the app onto **Applications**. Choose **Replace** when asked.
3. Approve it once more, following **step 2** above. macOS treats each new version as a new app.

## Uninstalling

Drag **Compress Studio** from Applications to the Bin.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| No **Open Anyway** button in Privacy & Security | Try to open the app again (step 2.1), then go straight back to Privacy & Security. |
| *“Compress Studio is damaged and can't be opened”* | The download may have been interrupted. Delete the app and the .dmg, ask for the file again and reinstall. If it still happens, ask whoever sent it to run the command at the bottom of this page. |
| *“…can't be opened because it is from an unidentified developer”* with no Open Anyway | Your Mac may be managed by IT and set to block apps like this. Ask IT to allow **Compress Studio**. |
| The app says it can't open a folder | See **3. Allow access to your folders** above. |
| A file shows **couldn't process** | Hover over it to see why. Usually the file is damaged, still downloading, or a format the app can't read. Other files carry on as normal. |
| Videos are slow | Large or 4K videos can take several minutes each. Leave the app open. Your Mac won't sleep while it's working, and you'll get a notification when it's done. |

<details>
<summary>For whoever is helping: removing the download flag by hand</summary>

If the Open Anyway route isn't working, this Terminal command clears the “downloaded from the internet” flag so the app opens straight away. Only run it on a copy you know came from us.

```bash
xattr -dr com.apple.quarantine "/Applications/Compress Studio.app"
```

</details>
