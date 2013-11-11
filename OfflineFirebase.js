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
};

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
};

/*
	Override the child method to return a subclassed OfflineFirebase instead of an instance of
	the superclass.
*/
OfflineFirebase.prototype.child = function(pathString) {
	return new OfflineFirebase(this.toString() + '/' + pathString);
};

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
	
	// We need to clear already cached data in case data has been removed.
	OfflineFirebase._clearPath(initialPath);
	
	OfflineFirebase._walk(initialPath, exportVal, function(path, data) {
		localStorage.setItem(OfflineFirebase.namespace + 'partial_' + path, JSON.stringify(data));	// Update individual paths
	});
	
	// Log this global path as saved since we need to set it at its topmost node so it can be retrieved.
	// We will recompose it from its parts when saving so that we're sure we have the freshest data.
	// Also note, that if we have already stored one of its parents, we need not set this but we do anyway.
	/*
		Note: if you set /a/b and /a/c, retrieving /a will not be cached since Firebase doesn't know that
		/a/b and /a/c make up the complete contents of /a.
	*/
	localStorage.setItem(OfflineFirebase.namespace + 'full_' + initialPath, 1);
};

/*
	Clears data for this path and all children under it from localStorage.
*/
OfflineFirebase._clearPath = function(path) {
	for(var key in localStorage) {
		var indexOfPath = key.indexOf(OfflineFirebase.namespace + 'partial_' + path);
		if(indexOfPath === 0) {
			// This is a component of the path so we need to clear it.
			localStorage.removeItem(key);
		}
	}
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
				to store its priority but it also has children that we need
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
};

/*
	Takes all objects stored locally and performs a Firebase set operation
	to initialize the Firebase cache on a cold bootup.

	Note: this will overwrite the server value so you should use .validate
	rules to ensure that the proper data is used in the event of a merge
	conflict.

	Eg, in the case of high-scores, your .validate should enforce that the
	new value is higher than the old value. Or store a timestamp that takes
	the newest value of the 2.
	
	Currently O(n^2) on number of items in localStorage but I suspect we can
	do better... hasn't become a bottleneck for me yet, though.
*/ 
OfflineFirebase.restore = function() {
	for(var key in localStorage) {
		if(key && key.indexOf(OfflineFirebase.namespace + 'full_') === 0) {
			// This is one of our cached values
			
			var url = key.substring( (OfflineFirebase.namespace + 'full_' ).length );	// Remove the namespace to retrieve the URL
			var val = OfflineFirebase._reconstitute(url);
			
			var ref = new OfflineFirebase(url);
			ref.on('value', function() {}); // Register a callback so Firebase will cache this location
			ref.set(val); // Populate it with a value
		}
	}
}

/*
	Reconstitute a value from the sum of its parts (which are residing in localStorage).
*/
OfflineFirebase._reconstitute = function(path) {
	var ret = {};

	for(var key in localStorage) {
		var indexOfPath = key.indexOf(OfflineFirebase.namespace + 'partial_' + path);
		if(indexOfPath === 0) {
			// This is a component of the path so we need to add it to ret.
			
			var val = JSON.parse(localStorage[key]);
			var subKey = key.substring( (OfflineFirebase.namespace + 'partial_' + path).length ); // The path to this node relative to our root.
			
			// Create the nested object for this fragment if it doesn't already exist
			var currentTarget = ret;
			if(subKey) {
				var parts = subKey.split('/');
				
				for(var i=0; i<parts.length; i++) {
					if(!parts[i]) continue;
					if(typeof currentTarget[parts[i]] == 'undefined') currentTarget[parts[i]] = {};
					currentTarget = currentTarget[parts[i]];
				}
			}
			
			// Set the priority and value for our nested object
			if(typeof val == 'object') {
				if(val['.priority']) {
					currentTarget['.priority'] = val['.priority'];
				} else {
					currentTarget['.priority'] = null;
				}
				
				if(val['.value']) {
					// If this also contains a value primitive, escalate that.
					val = val['.value'];
				} else {
					// Otherwise we don't need to set any data for this node, just its priority.
					continue;
				}
			}
			
			currentTarget['.value'] = val;
		}
	}
	
	return ret;
};

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
};
