offline-firebase
================

A Firebase wrapper that stores a cache of your data offline in localStorage when there is no Internet connection available.

I built this for use in a Phonegap application that I am developing. The idea is that if a user is in offline mode (eg
on an airplane) the app should continue to work and then sync with the server once an internet connection is
available.

Firebase handles the syncing once the server is available part natively.

This extension adds cold-start support to repopulate Firebase's local cache with data that has been stored in localStorage.

To use this, you'll need to include the unminified Firebase script on your site.
It is available on their CDN here: http://cdn.firebase.com/v0/firebase-debug.js

(You will obviously want to download it and include it with your app rather than linking to the CDN for
use in offline mode.)

You will also need to include OfflineFirebase.js from this repository.

Then replace your calls to Firebase with OfflineFirebase and pass a fifth parameter to .on() or .once() to enable
the offline caching.

When your app starts up, if you don't have an Internet Connection available call OfflineFirebase.restore() to repopulate
from your localStorage cache.

Here's an example:

    OfflineFirebase.restore();
    var f = new OfflineFirebase('https://example.firebaseio.com');
    f.on('value', function(snapshot) {
        console.log(snapshot.val());
    }, undefined, undefined, true);

Close your application completely and turn on airplane mode. When you re-open it and run the above, your data will
still log out because it has been persisted through localStorage.
