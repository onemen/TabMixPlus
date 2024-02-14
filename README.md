![tabmix-header](https://github.com/onemen/TabMixPlus/assets/3650909/232b1106-10ed-4b07-ab7d-53301167a694)

**Tab Mix Plus** is a very popular _legacy_ extension for the Mozilla Firefox browser that enhances Firefox's tab browsing abilities. It includes such features as duplicating tabs, controlling tab focus, tab clicking options, undo closed tabs and windows, plus much more.<br/>
**Session Manager** feature is not included at the moment since it requires complete rewrite.

>If you are interested in keeping **Tab Mix Plus** working, please donate.
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?hosted_button_id=W25388CZ3MNU8)

<br/>

## Table of Contents <!-- omit in toc -->
- [Installation](#installation)
- [Troubleshooting](#troubleshooting)
- [Browser Compatibility](#browser-compatibility)
- [Configuration](#configuration)
- [Docs](#docs)

<br/>

## Installation
1. **_Legacy_ extensions loader**<br/>
Since Firefox removed the internal component that loads _legacy_ extension, in order to install **Tab Mix Plus**, or any other _legacy_ extension, you have to install 3rd party helper scripts.

   1.1. Open `about:support` and locate the path to your **Application Binary** and **Profile Folder**.
   <details><summary>screenshoot</summary>

   ![firefox](https://github.com/onemen/TabMixPlus/assets/3650909/e39c4d4e-5bec-47fe-96d7-faba7fab24b2)
   </details>

   1.2. Install [configuration files](https://github.com/onemen/TabMixPlus/files/14075743/fx-folder.zip) to your **Application Binary** folder.<br/>
   `fx-folder.zip` files are packed with paths used by Firefox for Windows, `Linux` and `MacOS` users should follow the instructions below.
   <details>
     <summary>Linux</summary>

     **Note**:<br/>
     The default path to Firefox on Linux is typically `/usr/lib/firefox/`.

     **Verify the path**:<br/>
     Check the actual path to your Firefox **Application Binary**.
     If it differs from `/usr/lib/firefox/`, replace the path accordingly in the following instructions.

     **Copy the configuration files extracted from `fx-folder.zip`**:<br/>
     * copy `config.js` to `/usr/lib/firefox/config.js`
     * copy `config-prefs.js` to `/usr/lib/firefox/browser/defaults/preferences/config-prefs.js`  
   </details>

   <details>
     <summary>Linux with Snap</summary>

     **Compatibility Note**:<br/>
     `Firefox snap for Linux` versions prior to 108 are not supported.

     **Instructions for Firefox snap 108 or newer**

     **Verify installation path**:<br/>
     If you're uncertain about the installation path of your Firefox snap, use the command `snap list firefox` in your terminal to check.

     **Copy the configuration files extracted from `fx-folder.zip`**:<br/>
     * copy `config.js` to `/etc/firefox/config.js`
     * copy `config-prefs.js` to `/etc/firefox/defaults/pref/config-prefs.js`

     <br/>

     **Create subfolders if necessary**<br/>
     If the folders /defaults or /pref don't exist within /etc/firefox/ create them.
   </details>

   <details>
     <summary>MacOs</summary>

     **Note**:<br/>
     The default path to Firefox on MacOs is typically `Firefox.app/Contents/Resources`.

     **Verify the path**:<br/>
     Check the actual path to your Firefox **Application Binary**.
     If it differs from `Firefox.app/Contents/Resources`, replace the path accordingly in the following instructions.

     **Copy the configuration files extracted from `fx-folder.zip`**:<br/>
     * copy `config.js` to `Firefox.app/Contents/Resources/config.js`
     * copy `config-prefs.js` to `Firefox.app/Contents/Resources/defaults/pref/config-prefs.js`
   </details>

   1.3. Create `chrome` folder in your **Profile Folder** (if one does not exist).

   1.4. Extract [utils](https://github.com/onemen/TabMixPlus/files/14075742/utils_extensions_and_scripts.zip) folder inside the `chrome` folder, the result should be `[PROFILE_NAME]/chrome/utils`, all the files should be in the `utils` folder (see the screenshot below).

   <details><summary>screenshoot</summary>

   ![firefox](https://github.com/onemen/TabMixPlus/assets/3650909/fc5da575-2c75-493e-8342-34f1142ece4a)
   </details>

   1.5. Open `about:support` page and click "Clear startup cache…" to force Firefox to load the installed scripts on the next startup.

   1.6. Start Firefox again.

   1.7. Follow the instructions below to install `Tab Mix Plus`.

   <br/>

1. **Download XPI**<br/>
    Download xpi file from our [releases](https://github.com/onemen/TabMixPlus/releases) page to your local computer.<br/>
    All **Tab Mix Plus** downloads are also located [here](https://bitbucket.org/onemen/tabmixplus-for-firefox/downloads/).
    >If you are using Firefox Beta, Developer Edition or Nightly we recommend using the latest **Tab Mix Plus** _development build_ (tags with **pre** or **test-build** in the title)

<br/>

3. **Install XPI**<br/>
   To install the file you have just downloaded:
   * Open `Add-ons Manager` tab (about:addons) and select `Extensions`.
     <br/>or<br/>
     Click the menu button ☰, click `Add-ons and Themes` and select `Extensions`.
   * To add the downloaded add-on to the list of available add-ons, drag and drop the file into the Add-ons window. The add-on is added to the list.
   * The installation process should begin.

<br/>

## Troubleshooting
If <b>Tab Mix Plus</b> stops working after Firefox update was installed or when you try to install Tab Mix you get a message that it `appears to be corrupt`, follow these instructions

* Uninstall **Tab Mix Plus**.
* Close Firefox and **reinstall** the latest versions of these scripts (see instructions above):
  * Install [configuration files](https://github.com/onemen/TabMixPlus/files/14075743/fx-folder.zip) to your **Application Binary** folder.

  * Extract [utils](https://github.com/onemen/TabMixPlus/files/14075742/utils_extensions_and_scripts.zip) folder to `chrome` in your in your **Profile Folder**.

* Open <b>about:support</b> page and click "Clear startup cache…" to force Firefox to load the installed scripts on the next startup.</li>
* After Firefox starts **Reinstall** latest <b>Tab Mix Plus</b> again.

<br/>

## Browser Compatibility
  * Firefox 78 - Firefox Nightly
  * Waterfox G3 - G6 and beyond

> For **Pale Moon** download **Tab Mix Plus** from [here](https://addons.palemoon.org/addon/tab-mix-plus/)

<br/>

## Configuration
Tab Mix Plus comes with Options window that includes all of its preferences as well as adding user interface to important Firefox hidden preferences. It is recommended that you make all changes to the preference in the options window. The options window is available from the Add-ons Manager or from the Tools menu (unless you turn this option off).

<br/>

## Docs
[Help](https://onemen.github.io/tabmixplus-docs/help/index.html)

[Troubleshooting](https://onemen.github.io/tabmixplus-docs/troubleshooting/index.html)

[Change Log](https://onemen.github.io/tabmixplus-docs/changelog/index.html)
