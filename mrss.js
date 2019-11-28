function mrss() {
    return {
        requestInterval: 5*60*1000, //5 min
        init: function(data, id) {
            this.$ = jQuery;
            this.url = data.url;
            this.filter = data.filter;
            this.id = id;
            this.feed = null;
            this.storage = window.localStorage;
            this.template = Handlebars.compile(
                document.getElementById('template-' + id + '-mrss').innerHTML);
            this.restoreData();
            this.getFeedData(this.url);
            var _this = this;
            this.intervalId = window.setInterval(function(){
                _this.getFeedData(_this.url);
            }, this.requestInterval);
        },

        cache: function(rssData) {
            this.clearImageCache();
            this.cacheFeed(rssData);
        },

        cacheFeed: function(feedData) {
            this.storage.setItem('feed:'+this.url, JSON.stringify(feedData));
        },

        cacheImage: function(img) {
            var base64 = this.imageToBase64(img);
            this.storage.setItem(this.id+':'+img.src, base64);
        },

        clearImageCache: function() {
            for(item in this.storage) {
                if(item.indexOf(this.id+':')>-1) {
                    this.storage.removeItem(item);
                }
            }
        },

        imageToBase64: function(img) {
            // Create an empty canvas element
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, img.width, img.height);

            var dataURL  = canvas.toDataURL("image/png");

            return dataURL;
        },

        getFeedData: function(url) {
            var _this = this;
            this.$.get(url, function(data){
                _this.feedMRSSCalback(data);
            });
        },

        feedMRSSCalback: function(data) {
            if(!this.feed || this.feed != data) {
                this.feed = data;
                var rssData = this.parseFeed(data);
                this.cache(rssData);
                this.render(rssData);
            }
        },

        loadCachedFeed: function() {
            var feedData = this.storage.getItem('feed:' + this.url);
            if(feedData) {
                return JSON.parse(feedData);
            }
            return false;
        },
        parseFeed: function(data) {
            var result = [];
            var _this = this;
            var ttl = parseInt(this.$(data).find("ttl").text());
            if(!isNaN(ttl)) this.updateInterval(ttl);
            this.$(data).find("item").each(function() {
                var obj = {media:{}, fields: {}};
                _this.$(this.childNodes).each(function() {
                    var nodeName = this.nodeName.toLowerCase();
                    switch(nodeName) {
                        case 'media:content':
                            obj.media.url = this.getAttribute('url');
                            if(this.getAttribute('medium') == 'image') {
                                obj.media.image = true;
                                obj.media.tag = '<img src="'+obj.media.url+'">';
                            } else if(this.getAttribute('medium') == 'video') {
                                obj.media.video = true;
                                obj.media.tag =
                                '<video hwz="on" loop autoplay src="'
                                + obj.media.url + '">';
                            }
                            break;
                        case 'title':
                        case 'media:title':
                            obj.fields.title = this.textContent;
                            break;
                        case 'description':
                        case 'media:description':
                            obj.fields.description = this.textContent;
                            break;
                        default:
                            var nodesList = ['#text',
                            'category',
                            'guid',
                            'link',
                            'language',
                            'copyright',
                            'pubDate'];
                            if(this.textContent != ''
                                && this.nodeName.indexOf('media:') < 0
                                && _this.indexOf(nodesList, this.nodeName) < 0){
                                obj.fields[this.nodeName.toLowerCase()]
                                = this.textContent;
                            }
                            break;
                    }
                });
                result.push(obj);
            });
            return result;
        },

        restoreData: function() {
            var localData = this.loadCachedFeed();
            if(localData) {
                for(var i=0; i<localData.length; i++) {
                    if(localData[i].media.image) {
                        localData[i].media.url = this.storage.getItem(this.id
                            + ':' + localData[i].media.url);
                        localData[i].media.tag = '<img src="'
                            + localData[i].media.url+'">';
                    }
                }
                this.render(localData, true);
            }
        },

        indexOf: function (arr, expr) {
            for(var i=0; i < arr.length; i++) {
                if(arr[i] == expr) return i;
            }
            return -1;
        },

        render: function(rssData, cache) {
            var $items = this.renderItems(rssData, cache);
            var $block = this.$("#"+this.id);
            $block.empty();
            $block.append($items);

            //testing scope change
            var listHeight = 0;
            var headerlogo = $(".logoHeader").outerHeight(true);
            var footerlogo = $(".logoFooter").outerHeight(true);
            var baseheight = 804-(headerlogo+footerlogo+20*2); //20*2: top and bottom padding
            $(".itemblock").outerHeight(function() {
                listHeight += $(this).outerHeight(true) + 6;
            });
            $(".brs-brightplates-block").height(listHeight);
            var menublock = $("#menuBlockL");
            menublock.css("height", listHeight);
            if(listHeight > baseheight) {
                //var heightdif = menublock.outerHeight(true) - menublock.innerHeight();
                //menublock.css("height", listHeight/* + heightdif*/);
                menublock.css("animation", "ticker " + baseheight/30 + "s linear infinite");
            }
        },

        renderItems: function(rssData, cache) {
            var $block = this.$('<div class="brs-brightplates-block-mrss">');
            if(rssData) {
                var filter = null;
                if(this.filter && this.filter != 'all') {
                    switch (this.filter) {
                        case 'even':
                            filter = function(i) { return (i % 2 == 1) };
                            break;
                        case 'odd':
                            filter = function(i) { return (i % 2 == 0) };
                            break;
                        default:
                            if(Array.isArray(this.filter)) {
                                var indexes = this.filter;
                                filter = function(i) {
                                    return (indexes.indexOf(i) > -1)
                                };
                            }
                    }
                }
                for(var i=0; i< rssData.length; i++) {
                    if(filter == null || filter(i)) {
                        var $item = $(this.template(rssData[i]));
                        if(!cache) {
                            var _mrss = this;
                            $item.find("img").load(function() {
                                _mrss.cacheImage(this);
                            });
                        }
                        $block.append($item);
                    }
                }
            }
            return $block;
        },
        updateInterval: function(ttl) {
            this.requestInterval = ttl * 60 * 1000;
            window.clearInterval(this.intervalId);
            var _this = this;
            this.intervalId = window.setInterval(function(){
                _this.getFeedData(_this.url);
            }, this.requestInterval);
        }
    };
}
