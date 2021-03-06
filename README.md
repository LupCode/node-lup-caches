# lup-caches
Node module that offers efficient caches that store key-value pairs.

## How to use
1. Install with the following command `npm install lup-caches`  
2. Reference in your NodeJS project by adding `const caches = require('lup-caches');`.  
See [Examples](#examples)

## Available Classes
#### `FixedSizeLFUCache`
Fixed size cache storing key-value pairs such that total  
byte size of stored values will not exceed given limit.  
Uses the LFU algortihm (least frequently used) to evict entries if cache is full.  
Additionally an expire interval can be set (passive on put call) that repeatedly halfs  
the access counter of each entry.  

#### `FixedCountLFUCache`
Cache storing fixed amount of key-value pairs.  
Uses the LFU algortihm (least frequently used) to evict entries if cache is full.  
Additionally an expire interval can be set (passive on put call) that repeatedly halfs  
the access counter of each entry.  

#### `FixedSizeLRUCache`
Fixed size cache storing key-value pairs such that total 
byte size of stored values will not exceed given limit. 
Uses the LRU algortihm (least recently used) to evict entries if cache is full. 
Cheaper and faster than LFU but not as many cache hits.  

#### `FixedCountLRUCache`
Cache storing fixed amount of key-value pairs.
Uses the LRU algortihm (least recently used) to evict entries if cache is full. 
Cheaper and faster than LFU but not as many cache hits.  


## Examples
```javascript
const {FixedSizeLFUCache} = require('lup-caches');

let maxSize = 10.5; // MB
let cache = new FixedSizeLFUCache(maxSize);

cache.put("test", "Hello World");
cache.put("abc", Buffer.from("e.g. contents of a file. Must not be of type string"));

cache.get("test"); // returns "Hello World" if entry still in cache
```
