/*
	Extend the Firebase class.
*/
function OfflineFirebase(url) {
	goog.base(this, url);
}
goog.inherits(OfflineFirebase, Firebase);

/*
	Override the Firebase .on(...) method to allow us to hijack and cache
	data as it comes in.
	
	Note the cacheOffline flag that has been added to this method. In order
	to enable the offline caching, set this to true.
*/
OfflineFirebase.prototype.on = function(eventType, callback, cacheOffline) {
	var metaCallback = callback;
	
	if(cacheOffline) {
		metaCallback = function(snapshot) {
			// Store value locally so we can restore it later.
			OfflineFirebase.store(snapshot);
		
			callback(snapshot);
		};
	}

	// Register the callback with the superclass.
	OfflineFirebase.superClass_.on.call(this, eventType, metaCallback);
}

/*
	Stores the data from a snapshot in localStorage so we can restore it
	later.
	
	This works by retrieving the .exportVal() from the snapshot, iterating
	over the object tree, and storing each leaf (a leaf is defined as a node
	named ".value" or ".priority") into a localStorage item.
*/
OfflineFirebase.store = function(snapshot) {
	var exportVal = snapshot.exportVal();
	
	
}

/*
	Takes all objects stored locally and performs a Firebase set operation
	to initialize the Firebase cache on a cold bootup.

	Note: this will overwrite the server value so you should use .validate
	rules to ensure that the proper data is used in the event of a merge
	conflict.

	Eg, in the case of high-scores, your .validate should enforce that the
	new value is higher than the old value. Or store a timestamp that takes
	the newest value of the 2.
*/ 
OfflineFirebase.restore = function() {
	
}

/*
	Clear the localStorage of all OfflineFirebase related items.
	
	Note: these items will still be stored by Firebase's internal cache if
	they have been requested (or stored) already on this page-load.
*/
OfflineFirebase.clear = function() {
	
}