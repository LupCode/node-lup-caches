/**
 * Fixed size cache storing key-value pairs such that total 
 * byte size of stored values will not exceed given limit. 
 * Uses the LFU algortihm (least frequently used) to evict entries if cache is full. 
 * Additionally an expire interval can be set (passive on {@code put()} call) that repeatedly halfs 
 * the access counter of each entry.
 * @author LupCode.com
 */
class FixedSizeLFUCache {
    #maxSize;
    #expireMs;
    #size = 0;
    #entries = {}; // key: {value: Object, size: int, accesses: int, onEvict: function}
    #nextExpire;

    /**
     * Creates a new cache with a fixed storing capacity
     * @param {Number} maxSizeMB Limit how many mega bytes cache can store
     * @param {int} expireMs If >= 0 expire interval in milliseconds at which access counters are halfed
     */
    constructor(maxSizeMB, expireMs=60000){
        this.#maxSize = Math.floor(maxSizeMB * 1024 * 1024);
        this.#expireMs = Math.floor(expireMs);
        this.#nextExpire = Date.now() + this.#expireMs;
    }

    /**
     * @returns Amount of key-value pairs stored in cache
     */
     getCount(){
        return Object.keys(this.#entries).length;
    }

    /**
     * @returns Total size of stored entries in mega bytes
     */
    getSizeInMB(){
        return this.#size / 1024 / 1024;
    }

    /**
     * @returns Maximum total size of stored entries in mega bytes
     */
    getMaxSizeMB(){
        return this.#maxSize / 1024 / 1024;
    }

    /**
     * Sets the maximum size the total byte size of all values is not allowed to exceed
     * @param {Number} maxSizeMB Maximum byte size of all values in mega byte
     */
    setMaxSizeMB(maxSizeMB){
        this.#maxSize = parseInt(maxSizeMB * 1024 * 1024);
    }

    /**
     * @returns Milliseconds interval at which the access counter of entry entry gets halfed (negative means disabled)
     */
    getExpireTime(){
        return this.#expireMs;
    }

    /**
     * Sets the interval at which the access counter of each entry gets halfed
     * @param {int} expireMs Milliseconds of interval at which the access counters of all entries are halfed (negative means disabled)
     */
    setExpireTime(expireMs){
        this.#expireMs = parseInt(expireMs);
    }

    /**
     * Puts a key-value pair into cache
     * @param {String} key Unique key to reference value in cache
     * @param {*} value Value that should be put into cache
     * @param {Object} options Additional options that can be set: 
     *  - size:     int         Size in bytes of value (if value is {@type String} or {@type Buffer} size parameter not required)
     *  - onEvict:  Function    Callback that gets called with key and value that were evicted from cache (if returns {@code false} pair does not get evicted)
     * @returns True if successfully put key-value pair into cache or false if value is too big to fit into cache
     * @throws Error if size is not given while value is not of type String nor of type Buffer
     */
    put(key, value, options={size: undefined, onEvict: function(k,v){}}){
        if(!key || (typeof key !== 'string' && !(key instanceof String))) throw new Error("Key must be defined and of type String");
        if(!options.size){
            if(typeof key === 'string' || value instanceof String || value instanceof Buffer){
                options.size = Buffer.byteLength(value);
            } else {
                throw Error("Byte size must be provided for a value of type " + (typeof value));
            }
        }
        if(options.size > this.#maxSize) return false;

        // half all 'access' counters if expired
        if(this.#expireMs >= 0){
            const now = Date.now();
            if(this.#nextExpire < now){
                this.#nextExpire = now + this.#expireMs;
                for(let v of Object.values(this.#entries)) v.accesses = Math.floor(v.accesses / 2);
            }
        }

        // evict entries until enough space is available for new entry
        if(this.#maxSize - this.#size < options.size){
            let sorted = Object.entries(this.#entries).sort(function([, a], [, b]){ return a.accesses-b.accesses;  });
            let index = 0;
            while(index < sorted.length && this.#maxSize - this.#size < options.size) {
                let entry = sorted[index++];
                if(entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
                this.#size -= entry[1].size;
                delete this.#entries[entry[0]];
            }
            if(this.#maxSize - this.#size < options.size) return false;
        }

        // put new entry into cache
        this.#size += options.size;
        this.#entries[key] = {
            value: value,
            size: options.size,
            accesses: 1,
            onEvict: options.onEvict
        };

        return true;
    }


    /**
     * Returns a value from the cache by its key (if it is still in the cache)
     * @param {String} key Key of the value that should be returned
     * @returns Value if found or undefined if not found
     */
    get(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        entry.accesses++;
        return entry.value;
    }


    /**
     * Removes a key-value pair from the cache immediatly. 
     * Will not trigger the onEvict callback if defined.
     * @param {String} key Key of the value that should be removed
     * @returns Value of the removed key-value pair or undefined if not found
     */
    remove(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        this.#size -= entry.size;
        
        let value = entry.value;
        delete this.#entries[key];
        return value;
    }


    /**
     * Clears the cache without calling the {@code onEvict} callbacks (by default)
     * @param {bool} callEvictCallbacks If {@code true} for each entry the {@code onEvict} callback will be called 
     * which can prevent evicting the entry by returning {@type false}.
     */
    clear(callEvictCallbacks=false){
        for(let entry of Object.entries(this.#entries)){
            if(callEvictCallbacks && entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
            this.remove(entry[0]);
        }
    }

    /**
     * @returns String containing basic information about this cache
     */
    toString(){
        return this.constructor.name + "{size=" + Number(this.getSizeInMB()).toFixed(2) + "/" + Number(this.getMaxSizeMB()).toFixed(2) + 
        "MB; entries=" + this.getCount() + "; expireInterval=" + this.getExpireTime() + "}";
    }
}




/**
 * Cache storing fixed amount of key-value pairs.
 * Uses the LFU algortihm (least frequently used) to evict entries if cache is full. 
 * Additionally an expire interval can be set (passive on {@code put()} call) that repeatedly halfs 
 * the access counter of each entry.
 * @author LupCode.com
 */
class FixedCountLFUCache {
    #maxCount;
    #count = 0;
    #expireMs;
    #entries = {}; // key: {value: Object, accesses: int, onEvict: function}
    #nextExpire;

    /**
     * Creates a new cache with a fixed storing capacity
     * @param {Number} maxCount Maximum amount of key-value pairs that can be hold
     * @param {int} expireMs If >= 0 expire interval in milliseconds at which access counters are halfed
     */
    constructor(maxCount, expireMs=5000){
        this.#maxCount = parseInt(maxCount);
        this.#expireMs = parseInt(expireMs);
        this.#nextExpire = Date.now() + this.#expireMs;
    }

    /**
     * @returns Amount of key-value pairs stored in cache
     */
    getCount(){
        return this.#count;
    }

    /**
     * @returns Maximum amount of key-value pairs that can be hold
     */
    getMaxCount(){
        return this.#maxCount;
    }

    /**
     * Sets the maximum amount of entries the cache can hold
     * @param {int} maxCount Maximum amount of key-value pairs
     */
    setMaxCount(maxCount){
        this.#maxCount = parseInt(maxCount);
    }

    /**
     * @returns Milliseconds interval at which the access counter of entry entry gets halfed (negative means disabled)
     */
     getExpireTime(){
        return this.#expireMs;
    }

    /**
     * Sets the interval at which the access counter of each entry gets halfed
     * @param {int} expireMs Milliseconds of interval at which the access counters of all entries are halfed (negative means disabled)
     */
    setExpireTime(expireMs){
        this.#expireMs = parseInt(expireMs);
    }

    /**
     * Puts a key-value pair into cache
     * @param {String} key Unique key to reference value in cache
     * @param {*} value Value that should be put into cache
     * @param {Object} options Additional options that can be set: 
     *  - onEvict:  Function    Callback that gets called with key and value that were evicted from cache (if returns {@code false} pair does not get evicted)
     * @returns True if successfully put key-value pair into cache or false if value is too big to fit into cache
     */
    put(key, value, options={onEvict: function(k,v){}}){
        if(!key || (typeof key !== 'string' && !(key instanceof String))) throw new Error("Key must be defined and of type String");

        // half all 'access' counters if expired
        if(this.#expireMs >= 0){
            const now = Date.now();
            if(this.#nextExpire < now){
                this.#nextExpire = now + this.#expireMs;
                for(let v of Object.values(this.#entries)) v.accesses = Math.floor(v.accesses / 2);
            }
        }

        // evict entries until enough space is available for new entry
        if(this.#count >= this.#maxCount){
            let sorted = Object.entries(this.#entries).sort(function([, a], [, b]){ return a.accesses-b.accesses;  });
            let index = 0;
            while(index < sorted.length && this.#count >= this.#maxCount) {
                let entry = sorted[index++];
                if(entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
                this.#count--;
                delete this.#entries[entry[0]];
            }
            if(this.#count >= this.#maxCount) return false;
        }

        // put new entry into cache
        this.#entries[key] = {
            value: value,
            accesses: 1,
            onEvict: options.onEvict
        };
        this.#count++;
        return true;
    }


    /**
     * Returns a value from the cache by its key (if it is still in the cache)
     * @param {String} key Key of the value that should be returned
     * @returns Value if found or undefined if not found
     */
    get(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        entry.accesses++;
        return entry.value;
    }


    /**
     * Removes a key-value pair from the cache immediatly. 
     * Will not trigger the onEvict callback if defined.
     * @param {String} key Key of the value that should be removed
     * @returns Value of the removed key-value pair or undefined if not found
     */
    remove(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;

        this.#count--;
        let value = entry.value;
        delete this.#entries[key];
        return value;
    }


    /**
     * Clears the cache without calling the {@code onEvict} callbacks (by default)
     * @param {bool} callEvictCallbacks If {@code true} for each entry the {@code onEvict} callback will be called 
     * which can prevent evicting the entry by returning {@type false}.
     */
    clear(callEvictCallbacks=false){
        for(let entry of Object.entries(this.#entries)){
            if(callEvictCallbacks && entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
            delete this.#entries[entry[0]]; 
        }
    }

    /**
     * @returns String containing basic information about this cache
     */
    toString(){
        return this.constructor.name + "{entries=" + this.getCount() + "/" + this.getMaxCount() + "; expireInterval=" + this.getExpireTime() + "ms}";
    }
}




/**
 * Fixed size cache storing key-value pairs such that total 
 * byte size of stored values will not exceed given limit. 
 * Uses the LRU algortihm (least recently used) to evict entries if cache is full. 
 * Cheaper and faster than LFU but not as many cache hits.
 * @author LupCode.com
 */
class FixedSizeLRUCache {
    #maxSize;
    #size = 0;
    #head = null; // string
    #tail = null; // string
    #entries = {}; // key: {value: Object, size: int, prev: String, next: String, onEvict: function}

    /**
     * Creates a new cache with a fixed storing capacity
     * @param {Number} maxSizeMB Limit how many mega bytes cache can store
     */
    constructor(maxSizeMB){
        this.#maxSize = Math.floor(maxSizeMB * 1024 * 1024);
    }

    /**
     * @returns Amount of key-value pairs stored in cache
     */
     getCount(){
        return Object.keys(this.#entries).length;
    }

    /**
     * @returns Total size of stored entries in mega bytes
     */
    getSizeInMB(){
        return this.#size / 1024 / 1024;
    }

    /**
     * @returns Maximum total size of stored entries in mega bytes
     */
    getMaxSizeMB(){
        return this.#maxSize / 1024 / 1024;
    }

    /**
     * Sets the maximum size the total byte size of all values is not allowed to exceed
     * @param {Number} maxSizeMB Maximum byte size of all values in mega byte
     */
    setMaxSizeMB(maxSizeMB){
        this.#maxSize = parseInt(maxSizeMB * 1024 * 1024);
    }

    /**
     * Puts a key-value pair into cache
     * @param {String} key Unique key to reference value in cache
     * @param {*} value Value that should be put into cache
     * @param {Object} options Additional options that can be set: 
     *  - size:     int         Size in bytes of value (if value is {@type String} or {@type Buffer} size parameter not required)
     *  - onEvict:  Function    Callback that gets called with key and value that were evicted from cache (if returns {@code false} pair does not get evicted)
     * @returns True if successfully put key-value pair into cache or false if value is too big to fit into cache
     * @throws Error if size is not given while value is not of type String nor of type Buffer
     */
    put(key, value, options={size: undefined, onEvict: function(k,v){}}){
        if(!key || (typeof key !== 'string' && !(key instanceof String))) throw new Error("Key must be defined and of type String");
        if(!options.size){
            if(typeof key === 'string' || value instanceof String || value instanceof Buffer){
                options.size = Buffer.byteLength(value);
            } else {
                throw Error("Byte size must be provided for a value of type " + (typeof value));
            }
        }
        if(options.size > this.#maxSize) return false;

        // evict entries until enough space is available for new entry
        if(this.#maxSize - this.#size < options.size){
            let curr = this.#head;
            while(curr && this.#maxSize - this.#size < options.size) {
                let entry = this.#entries[curr];
                if(entry.onEvict && entry.onEvict(this.#head, entry.value) === false){ curr = entry.next; continue; }
                this.#size -= entry.size;
                if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
                if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;
                let nextKey = entry.next;
                delete this.#entries[curr];
                if(curr == this.#head) this.#head = nextKey;
                curr = nextKey;
            }
            if(this.#maxSize - this.#size < options.size) return false;
        }

        // put new entry into cache
        this.#size += options.size;
        this.#entries[key] = {
            value: value,
            size: options.size,
            prev: this.#tail,
            next: null,
            onEvict: options.onEvict
        };
        if(!this.#head) this.#head = key;
        if(this.#tail) this.#entries[this.#tail].next = key;
        this.#tail = key;
        return true;
    }


    /**
     * Returns a value from the cache by its key (if it is still in the cache)
     * @param {String} key Key of the value that should be returned
     * @returns Value if found or undefined if not found
     */
    get(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        if(key == this.#tail) return entry.value;
        if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
        if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;
        entry.next = null;
        entry.prev = this.#tail;
        if(this.#tail) this.#entries[this.#tail].next = key;
        this.#tail = key;
        return entry.value;
    }


    /**
     * Removes a key-value pair from the cache immediatly. 
     * Will not trigger the onEvict callback if defined.
     * @param {String} key Key of the value that should be removed
     * @returns Value of the removed key-value pair or undefined if not found
     */
    remove(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        this.#size -= entry.size;
        if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
        if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;

        let value = entry.value;
        delete this.#entries[key];
        return value;
    }


    /**
     * Clears the cache without calling the {@code onEvict} callbacks (by default)
     * @param {bool} callEvictCallbacks If {@code true} for each entry the {@code onEvict} callback will be called 
     * which can prevent evicting the entry by returning {@type false}.
     */
    clear(callEvictCallbacks=false){
        for(let entry of Object.entries(this.#entries)){
            if(callEvictCallbacks && entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
            this.remove(entry[0]);
        }
    }

    /**
     * @returns String containing basic information about this cache
     */
    toString(){
        return this.constructor.name + "{size=" + Number(this.getSizeInMB()).toFixed(2) + "/" + Number(this.getMaxSizeMB()).toFixed(2) + 
        "MB; entries=" + this.getCount() + "}";
    }
}




/**
 * Cache storing fixed amount of key-value pairs.
 * Uses the LRU algortihm (least recently used) to evict entries if cache is full. 
 * Cheaper and faster than LFU but not as many cache hits.
 * @author LupCode.com
 */
class FixedCountLRUCache {
    #maxCount;
    #count = 0;
    #head = null; // string
    #tail = null; // string
    #entries = {}; // key: {value: Object, size: int, prev: String, next: String, onEvict: function}

    /**
     * Creates a new cache with a fixed storing capacity
     * @param {Number} maxCount Maximum amount of key-value pairs that can be hold
     */
    constructor(maxCount){
        this.#maxCount = parseInt(maxCount);
    }

    /**
     * @returns Amount of key-value pairs stored in cache
     */
     getCount(){
        return this.#count;
    }

    /**
     * @returns Maximum amount of key-value pairs that can be hold
     */
    getMaxCount(){
        return this.#maxCount;
    }

    /**
     * Sets the maximum amount of entries the cache can hold
     * @param {int} maxCount Maximum amount of key-value pairs
     */
    setMaxCount(maxCount){
        this.#maxCount = parseInt(maxCount);
    }

    /**
     * Puts a key-value pair into cache
     * @param {String} key Unique key to reference value in cache
     * @param {*} value Value that should be put into cache
     * @param {Object} options Additional options that can be set: 
     *  - onEvict:  Function    Callback that gets called with key and value that were evicted from cache (if returns {@code false} pair does not get evicted)
     * @returns True if successfully put key-value pair into cache or false if value is too big to fit into cache
     * @throws Error if size is not given while value is not of type String nor of type Buffer
     */
    put(key, value, options={onEvict: function(k,v){}}){
        if(!key || (typeof key !== 'string' && !(key instanceof String))) throw new Error("Key must be defined and of type String");
        // evict entries until enough space is available for new entry
        if(this.#count >= this.#maxCount){
            let curr = this.#head;
            while(curr && this.#count >= this.#maxCount) {
                let entry = this.#entries[curr];
                if(entry.onEvict && entry.onEvict(this.#head, entry.value) === false){ curr = entry.next; continue; }
                if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
                if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;
                this.#count--;
                let nextKey = entry.next;
                delete this.#entries[curr];
                if(curr == this.#head) this.#head = nextKey;
                curr = nextKey;
            }
            if(this.#count >= this.#maxCount) return false;
        }

        // put new entry into cache
        this.#entries[key] = {
            value: value,
            prev: this.#tail,
            next: null,
            onEvict: options.onEvict
        };
        this.#count++;
        if(!this.#head) this.#head = key;
        if(this.#tail) this.#entries[this.#tail].next = key;
        this.#tail = key;
        return true;
    }


    /**
     * Returns a value from the cache by its key (if it is still in the cache)
     * @param {String} key Key of the value that should be returned
     * @returns Value if found or undefined if not found
     */
    get(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        if(key == this.#tail) return entry.value;
        if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
        if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;
        entry.next = null;
        entry.prev = this.#tail;
        if(this.#tail) this.#entries[this.#tail].next = key;
        this.#tail = key;
        return entry.value;
    }


    /**
     * Removes a key-value pair from the cache immediatly. 
     * Will not trigger the onEvict callback if defined.
     * @param {String} key Key of the value that should be removed
     * @returns Value of the removed key-value pair or undefined if not found
     */
    remove(key){
        let entry = this.#entries[key];
        if(!entry) return undefined;
        if(entry.prev) this.#entries[entry.prev].next = entry.next; else this.#head = entry.next;
        if(entry.next) this.#entries[entry.next].prev = entry.prev; else this.#tail = entry.prev;

        this.#count--;
        let value = entry.value;
        delete this.#entries[key];
        return value;
    }


    /**
     * Clears the cache without calling the {@code onEvict} callbacks (by default)
     * @param {bool} callEvictCallbacks If {@code true} for each entry the {@code onEvict} callback will be called 
     * which can prevent evicting the entry by returning {@type false}.
     */
    clear(callEvictCallbacks=false){
        for(let entry of Object.entries(this.#entries)){
            if(callEvictCallbacks && entry[1].onEvict && entry[1].onEvict(entry[0], entry[1].value) === false) continue;
            this.remove(entry[0]);
        }
    }

    /**
     * @returns String containing basic information about this cache
     */
     toString(){
        return this.constructor.name + "{entries=" + this.getCount() + "/" + this.getMaxCount() + "}";
    }
}


module.exports = {
    FixedSizeLFUCache,
    FixedCountLFUCache,
    FixedSizeLRUCache,
    FixedCountLRUCache
}