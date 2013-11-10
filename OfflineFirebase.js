function OfflineFirebase(url) {
	goog.base(this, url);
}
goog.inherits(OfflineFirebase, Firebase);

OfflineFirebase.prototype.auth = function(cred, onComplete, onCancel) {
	OfflineFirebase.superClass_.auth.call(this, cred, onComplete, onCancel);
}

OfflineFirebase.prototype.on = function(eventType, callback) {
	var metaCallback = function(snapshot) {
		callback(snapshot);
	};

	OfflineFirebase.superClass_.on.call(this, eventType, metaCallback);
}

OfflineFirebase.prototype.set = function(newVal, onComplete) {
	OfflineFirebase.superClass_.set.call(this, newVal, onComplete);
}

OfflineFirebase.prototype.setWithPriority = function(newVal, newPriority, onComplete) {
	OfflineFirebase.superClass_.setWithPriority.call(this, newVal, newPriority, onComplete);
}

OfflineFirebase.prototype.update = function(objectToMerge, onComplete) {
	OfflineFirebase.superClass_.update.call(this, objectToMerge, onComplete);
}

OfflineFirebase.prototype.push = function(value, onComplete) {
	OfflineFirebase.superClass_.push.call(this, value, onComplete);
}

OfflineFirebase.prototype.remove = function(onComplete) {
	OfflineFirebase.superClass_.remove.call(this, onComplete);
}

OfflineFirebase.prototype.setPriority = function(priority, opt_onComplete) {
	OfflineFirebase.superClass_.setPriority.call(this, priority, opt_onComplete);
}