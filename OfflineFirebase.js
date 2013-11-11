/*
	Extend the Firebase class.
*/
function OfflineFirebase(url) {
	goog.base(this, url);
}
goog.inherits(OfflineFirebase, Firebase);

/*
	Prefix for OfflineFirebase associated localStorage.
	
	This is used when storing to, retrieving from, and clearing the cache.
*/
OfflineFirebase.namespace = 'ofb_';

/*
	Override the Firebase .on(...) method to allow us to hijack and cache
	data as it comes in.
	
	Note the cacheOffline flag that has been added to this method. In order
	to enable the offline caching, set this to true.
*/
OfflineFirebase.prototype.on = function(eventType, callback, cancelCallback, context, cacheOffline) {
	var metaCallback = callback;
	
	if(cacheOffline) {
		metaCallback = function(snapshot) {
			// Store value locally so we can restore it later.
			OfflineFirebase.store(snapshot);
		
			callback(snapshot);
		};
	}

	// Register the callback with the superclass.
	OfflineFirebase.superClass_.on.call(this, eventType, metaCallback, cancelCallback, context);
}

/*
	Also override the .once(...) method in a similar manner
*/
OfflineFirebase.prototype.once = function(eventType, callback, cancelCallback, context, cacheOffline) {
	var metaCallback = callback;
	
	if(cacheOffline) {
		metaCallback = function(snapshot) {
			// Store value locally so we can restore it later.
			OfflineFirebase.store(snapshot);
		
			callback(snapshot);
		};
	}

	// Register the callback with the superclass.
	OfflineFirebase.superClass_.once.call(this, eventType, metaCallback, cancelCallback, context);
}

/*
	Stores the data from a snapshot in localStorage so we can restore it
	later.
	
	This works by retrieving the .exportVal() from the snapshot, iterating
	over the object tree, and storing each leaf (a leaf is defined as a node
	named ".value" or ".priority") into a localStorage item.
*/
OfflineFirebase.store = function(snapshot) {
	var initialPath = snapshot.ref().toString();
	var exportVal = snapshot.exportVal();
	
	OfflineFirebase._walk(initialPath, exportVal, function(path, data) {
		console.log('storing ' + path);
		localStorage.setItem(OfflineFirebase.namespace + path, JSON.stringify(data));
	});
}

/*
	Recursively traverses a primitive JavaScript object that represents the
	exportVal() of a Firebase DataSnapshot and runs callback for each leaf node.
*/
OfflineFirebase._walk = function(path, exportVal, callback) {
	if(!exportVal) return;

	if(typeof exportVal == 'number' || typeof exportVal == 'string') {
		// Leaf node: simple type with null priority
		callback(path, exportVal);
	} else if(exportVal['.value'] && exportVal['.priority']) {
		// Leaf node: simple type with defined priority
		callback(path, {
			'.priority': exportVal['.priority'],
			'.value': exportVal['.value']
		});
	} else {
		if(exportVal['.priority']) {
			// "Leaf" node: complex type with defined priority
			/*
				Note: this is a "leaf" because it needs a node in localStorage
				to store its children but it also has children that we need
				to iterate over. This is probably an abuse of the "leaf"
				nomenclature.
			*/
			callback(path, {
				'.priority': exportVal['.priority']
			});
		}
		
		// Recurse over children of this node
		for(var child in exportVal) {
			if(child == '.priority' || child == '.value') continue; // We have already accounted for this pseudo-child earlier
			
			var childPath = path + '/' + child;
			OfflineFirebase._walk(childPath, exportVal[child], callback);
		}
	}
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
	// Data to write to Firebase to set their internal cache
	/*
		Note: we pull this all from localStorage before doing any writes
		in case there are any .on() listeners already setup that will write
		to our localStorage cache when Firebase updates so that we don't
		get weird behavior by editing localStorage while we're iterating
		through it.
	*/
	var dataQueue = [];
	
	// Queue with priorities to set
	/*
		Note: we set priorities *after* the entire data tree is restored
		because you can't set a priority of a non-existant data node.
	*/
	var priorityQueue = {};	// Lols since this is a queue of priorities.. not a priority queue.

	for(var key in localStorage) {
		if(key && key.indexOf(OfflineFirebase.namespace) === 0) {
			// This is one of our cached values
			
			var url = key.substring(OfflineFirebase.namespace.length);	// Remove the namespace to retrieve the URL
			var val = JSON.parse(localStorage[key]);
			
			if(typeof val == 'object') {
				if(val['.priority']) priorityQueue[url] = val['.priority'];
				
				if(val['.value']) {
					// If this also contains a value primitive, escalate that.
					val = val['.value'];
				} else {
					// Otherwise we don't need to set any data for this node, just its priority.
					continue;
				}
			}
			
			var priority = url.match(/\//); // Priority is the depth
			priority = priority?priority.length:0;	// Hack since .match() returns null if no matches were found (and an array otherwise)
			
			if(typeof dataQueue[priority] == 'undefined') dataQueue[priority] = [];
			dataQueue[priority].push({
				url: url,
				val: val
			});
		}
	}
	
	// Iterate through the data from deepest to shallowest
	var subQueue, data;
	while(subQueue = dataQueue.pop()) {
		while(data = subQueue.pop()) {
			console.log('Setting ' + data.url + ' to ' + data.val);
			new OfflineFirebase(data.url).set(data.val);
		}
	}
	
	// Now that the data is there we can set the priorities
	for(var url in priorityQueue) {
		console.log('Priority ' + url + ' to ' + priorityQueue[url]);
		new OfflineFirebase(url).setPriority(priorityQueue[url]);
	}
}

/*
	Clear the localStorage of all OfflineFirebase related items.
	
	Note: these items will still be stored by Firebase's internal cache if
	they have been requested (or stored) already on this page-load.
*/
OfflineFirebase.clear = function() {
	for(var key in localStorage) {
		if(key && key.indexOf(OfflineFirebase.namespace) === 0) {
			// This is one of our cached values so remove it.
			localStorage.removeItem(key);
		}
	}
}