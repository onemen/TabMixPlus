![tabmix-header](https://github.com/onemen/TabMixPlus/assets/3650909/232b1106-10ed-4b07-ab7d-53301167a694)

<hr />

![update-header](https://github.com/user-attachments/assets/bbc5b5bb-0e2e-47aa-a1c5-6310548d8d02)
[Read more](https://onemen.github.io/tabmixplus-docs/update)

<hr />

**Tab Mix Plus** is a very popular _legacy_ extension for the Mozilla Firefox browser that enhances Firefox's tab browsing abilities. It includes such features as duplicating tabs, controlling tab focus, tab clicking options, undo closed tabs and windows, plus much more.

**Session Manager** feature is not included at the moment since it requires complete rewrite.

>If you are interested in keeping **Tab Mix Plus** working, please donate.
  [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M71J13A4)

---

## Exciting News! ✨<!-- omit in toc -->
Excited to Announce a New Home for **Tab Mix Plus** Documentation!

I'm thrilled to share the launch of a brand-new website dedicated to the **Tab Mix Plus** extension documentation! If you've been looking for clearer instructions, smoother navigation, and an overall better experience with **Tab Mix Plus** documentation, this site is for you.

### Here's what you can expect:
- Step-by-step installation: Getting started with **Tab Mix Plus** just got easier thanks to detailed instructions and troubleshooting tips. [Read More](https://onemen.github.io/tabmixplus-docs/other/installation/)

- Modern design: Say goodbye to clutter and hello to a clean, contemporary interface that's easy to read and navigate.

- Improved search: Find the information you need instantly with my enhanced search functionality.

- Accessible everywhere: Whether you're on a desktop, tablet, or mobile phone, the responsive design ensures a smooth experience.

I encourage you to explore the new documentation website and share your feedback! Your input is invaluable in helping me continuously improve the documentation and make it even more helpful for everyone.

### Ready to take a look?
- Visit the new [documentation](https://onemen.github.io/tabmixplus-docs/) web site.
- Learn how you can [contribute to the docs](https://github.com/onemen/tabmixplus-docs).

---

### 🚨 Important 🚨<!-- omit in toc -->
**Update Your Firefox Scripts for Firefox 142 Compatibility**

---

## Table of Contents <!-- omit in toc -->

- [Installation](#installation)
- [Troubleshooting](#troubleshooting)
- [Browser Compatibility](#browser-compatibility)
- [Configuration](#configuration)
- [Docs](#docs)


## Installation

1. **_Legacy_ extensions loader**<br />
Since Firefox removed the internal component that loads _legacy_ extension, in order to install **Tab Mix Plus**, or any other _legacy_ extension, you have to install 3rd party helper scripts. If you are using Waterfox, you can skip this and proceed to step 2.

   1.1. Open `about:support` and locate the path to your **Application Binary** and **Profile Folder**.
   <details><summary>screenshoot</summary>

   ![firefox](https://github.com/onemen/TabMixPlus/assets/3650909/e39c4d4e-5bec-47fe-96d7-faba7fab24b2)
   </details>

   1.2. Install [configuration files](https://github.com/onemen/TabMixPlus/releases/download/dev-build/fx-folder.zip) to your **Application Binary** folder.

   `fx-folder.zip` files are packed with paths used by Firefox for Windows, `Linux` and `MacOS` users should follow the instructions below.
   <details>
     <summary>Linux</summary>

     **Note**:
     The default path to Firefox on Linux is typically `/usr/lib/firefox/`.

     **Verify the path**:

     Check the actual path to your Firefox **Application Binary**.
     If it differs from `/usr/lib/firefox/`, replace the path accordingly in the following instructions.

     **Copy the configuration files extracted from `fx-folder.zip`**:

     * copy `config.js` to `/usr/lib/firefox/config.js`
     * copy `config-prefs.js` to `/usr/lib/firefox/browser/defaults/preferences/config-prefs.js`
   </details>

   <details>
     <summary>Linux with Snap</summary>

     **Compatibility Note**:

     `Firefox snap for Linux` versions prior to 108 are not supported.

     **Instructions for Firefox snap 108 or newer**

     **Verify installation path**:

     If you're uncertain about the installation path of your Firefox snap, use the command `snap list firefox` in your terminal to check.

     **Copy the configuration files extracted from `fx-folder.zip`**:

     * copy `config.js` to `/etc/firefox/config.js`
     * copy `config-prefs.js` to `/etc/firefox/defaults/pref/config-prefs.js`


     **Create subfolders if necessary**

     If the folders /defaults or /pref don't exist within /etc/firefox/ create them.
   </details>

   <details>
     <summary>MacOs</summary>

     **Note**:

     The default path to Firefox on MacOs is typically `Firefox.app/Contents/Resources`.

     **Verify the path**:

     Check the actual path to your Firefox **Application Binary**.
     If it differs from `Firefox.app/Contents/Resources`, replace the path accordingly in the following instructions.

     **Copy the configuration files extracted from `fx-folder.zip`**:

     * copy `config.js` to `Firefox.app/Contents/Resources/config.js`
     * copy `config-prefs.js` to `Firefox.app/Contents/Resources/defaults/pref/config-prefs.js`
   </details>

   1.3. Create `chrome` folder in your **Profile Folder** (if one does not exist).

   1.4. Extract [utils](https://github.com/onemen/TabMixPlus/releases/download/dev-build/utils.zip) folder inside the `chrome` folder, the result should be `[PROFILE_NAME]/chrome/utils`, all the files should be in the `utils` folder (see the screenshot below).

   <details><summary>screenshoot</summary>

   ![firefox](https://github.com/onemen/TabMixPlus/assets/3650909/fc5da575-2c75-493e-8342-34f1142ece4a)
   </details>

   1.5. Open `about:support` page and click "Clear startup cache…" to force Firefox to load the installed scripts on the next startup.

   1.6. Start Firefox again.

   1.7. Follow the instructions below to install `Tab Mix Plus`.



1. **Download XPI**

    Download xpi file from our [releases](https://github.com/onemen/TabMixPlus/releases) page to your local computer.

    >If you are using Firefox Beta, Developer Edition or Nightly we recommend using the latest **Tab Mix Plus** _development build_ (tags with **pre** or **test-build** in the title)
     Note that the latest development build is compatible with all supported versions of Firefox. (see [Browser Compatibility](https://onemen.github.io/tabmixplus-docs/other/installation/#browser-compatibility))


1. **Install XPI**

   To install the file you have just downloaded:
   * Open `Add-ons Manager` tab (about:addons) and select `Extensions`.
     or
     Click the menu button ☰, click `Add-ons and Themes` and select `Extensions`.
   * To add the downloaded add-on to the list of available add-ons, drag and drop the file into the Add-ons window. The add-on is added to the list.
   * The installation process should begin.



## Troubleshooting

If <b>Tab Mix Plus</b> stops working after Firefox update was installed or when you try to install Tab Mix you get a message that it `appears to be corrupt`, follow these instructions

* Uninstall **Tab Mix Plus**.
* Close Firefox and **reinstall** the latest versions of these scripts (see instructions above):
  * Install [configuration files](https://github.com/onemen/TabMixPlus/releases/download/dev-build/fx-folder.zip) to your **Application Binary** folder.

  * Extract [utils](https://github.com/onemen/TabMixPlus/releases/download/dev-build/utils.zip) folder to `chrome` in your in your **Profile Folder**.

* Some users report that their Firefox is not able to install or use **Tab Mix Plus** unless they set `extensions.experiments.enabled` to **true** in `about:config`.

* Open <b>about:support</b> page and click "Clear startup cache…" to force Firefox to load the installed scripts on the next startup.</li>
* After Firefox starts **Reinstall** latest <b>Tab Mix Plus</b> again.



## Browser Compatibility

Tab Mix Plus is fully compatible with the following browsers:

  * [Firefox](https://www.mozilla.org/en-US/firefox/all/#product-desktop-release) 128 ESR - Nightly
  * [Zen Browser](https://zen-browser.app/) 1.7+
  * [Waterfox](https://www.waterfox.net/) 6.5.0+
  * [Floorp](https://floorp.app/) 11.9.0+
  * [LibreWolf](https://librewolf.net/) 122+

> Firefox versions prior to 128 ESR are not supported.

> For **Pale Moon** download **Tab Mix Plus** from [here](https://addons.palemoon.org/addon/tab-mix-plus/)



## Configuration

Tab Mix Plus comes with Options window that includes all of its preferences as well as adding user interface to important Firefox hidden preferences. It is recommended that you make all changes to the preference in the options window. The options window is available from the Add-ons Manager or from the Tools menu (unless you turn this option off).



## Docs

Read the docs (please 🙏):

[Help](https://onemen.github.io/tabmixplus-docs/help/links/)

[Troubleshooting](https://onemen.github.io/tabmixplus-docs/troubleshooting/tabmix-does-not-work/)

[Change Log](https://github.com/onemen/TabMixPlus/releases)
