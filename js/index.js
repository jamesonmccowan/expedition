$(function () {
    var app = new Vue({
        "el": $("#app")[0],
        "data": {
            "mode": "dir",
            "path": "",
            "filter": "",
            "base": [],
            "history": [],
            "position": {"x": 0, "y": 0},

            "loading": false,
            "error_message": "",

            "selected": {"name": ""},
            "multi_selected": [],

            "show_context": 0,
            "show_path_detail": true,
            "font_size": 1,
            "details_obj": {},

            "press_timer": 0,
        },
        "methods": {
            "home": function () {
                var self = this;
                var base = [];
                this.base.map(function (b) { base.push(b); });
                this.history.push({
                    "path": this.path,
                    "base": base,
                });
                this.base.splice(0, this.base.length);

                try {
                    Object.keys(cordova.file).map(function (name) {
                        var path = cordova.file[name];
                        if (path) {
                            self.base.push({
                                "path": path,
                                "dir":  true,
                                "name": name,
                            });
                        }
                    });
                } catch (e) {
                    this.base = [{
                        "path": "file:///android_asset/",
                        "dir":  true,
                        "name": "applicationDirectory",
                    }, {
                        "path": "file:///data/data/_this_app_/",
                        "dir":  true,
                        "name": "applicationStorageDirectory",
                    }, {
                        "path": "file:///data/data/_this_app_/files/",
                        "dir":  true,
                        "name": "dataDirectory",
                    }, {
                        "path": "file:///data/data/_this_app_/cache/",
                        "dir":  true,
                        "name": "cacheDirectory",
                    }, {
                        "path": "file:///storage/emulated/0/" +
                            "Android/data/_this_app_/",
                        "dir":  true,
                        "name": "externalApplicationStorageDirectory",
                    }, {
                        "path": "file:///storage/emulated/0/" +
                            "Android/data/_this_app_/files/",
                        "dir":  true,
                        "name": "externalDataDirectory",
                    }, {
                        "path": "file:///storage/emulated/0/" +
                            "Android/data/_this_app_/cache/",
                        "dir":  true,
                        "name": "externalCacheDirectory",
                    }, {
                        "path": "file:///storage/emulated/0/",
                        "dir":  true,
                        "name": "externalRootDirectory",
                    }];
                }

                this.path = "";
                this.loading = false;
                this.error_message = "";
                this.mode = "dir";
            },
            "open": function (dir) {
                var self = this;
                if (!dir.dir) {
                    // if it's not a directory, open it as a file
                    // https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-inappbrowser/index.html
                    if (cordova && cordova.InAppBrowser.open) {
                        cordova.InAppBrowser.open(
                            dir.path,
                            "_system"
                        );
                    }
                    return;
                }
                if (dir.name == ".." && dir.path == "") {
                    this.home();
                    return;
                }

                // backup history
                var base = [];
                this.base.map(function (b) { base.push(b); });
                this.history.push({
                    "path": this.path,
                    "base": base,
                });

                // get ready for new list of files/dirs
                this.base.splice(0, this.base.length);
                this.base.push({
                    "dir":  true,
                    "path": this.path,
                    "name": "..",
                });
                this.loading = true;
                this.error_message = "";
                this.show_context = 0;

                if (
                    this.mode != "copy_to_dir" &&
                    this.mode != "move_to_dir"
                ) {
                    this.mode = "dir";
                }

                if (!window.resolveLocalFileSystemURL) {
                    this.loading = false;
                    this.error_message =
                        "File handling tools not loaded!";

                    return false;
                }

                window.resolveLocalFileSystemURL(dir.path,
                    function (fileSystem) {
                        var reader = fileSystem.createReader();
                        reader.readEntries(function (entries) {
                            if (self.loading) {
                                self.base.pop();
                                if (dir.path !== "file:///") {
                                    var parts = dir.path.split("/");
                                    parts.pop();
                                    parts.pop();
                                    self.base.push({
                                        "dir":  true,
                                        "path": parts.join("/"),
                                        "name": "..",
                                    });
                                }
                                entries.map(function (entry) {
                                    self.base.push({
                                        "dir":  !entry.isFile,
                                        "path": entry.nativeURL,
                                        "name": entry.name,
                                    });
                                });
                                self.path = dir.path;
                                self.loading = false;
                                self.$forceUpdate();
                            }
                        }, self.error);
                    }, this.error);
            },
            "error": function (err) {
                this.loading = false;
                this.error_message = err;
            },
            "back": function () {
                var self = this;
                if (this.mode == "dir") {
                    if (this.history.length > 0) {
                        var h = this.history.pop();
                        this.base.splice(0, this.base.length);
                        h.base.map(function (b) {
                            self.base.push(b);
                        });
                        this.path = h.path;
                    }
                    this.loading = false;
                    this.error_message = "";
                } else {
                    this.show_context = 0;
                    this.mode = "dir";
                }
            },
            "menuStart": function(event, dir) {
                var self = this;
                this.position.x = event.pageX;
                this.position.y = event.pageY;
                this.press_timer = window.setTimeout(function() {
                    self.openMenu(false, dir);
                }, 1000);
            },
            "menuMove": function(event) {
                var diffX = this.position.x - event.pageX;
                var diffY = this.position.y - event.pageY;
                var distance = Math.sqrt(
                    diffX * diffX + diffY * diffY
                );

                if (distance >= 10) {
                    this.menuStop();
                }
            },
            "menuStop": function() {
                clearTimeout(this.press_timer);
            },
            "openMenu": function (e, dir) {
                if (dir.name != "..") {
                    this.selected = dir;
                    this.show_context = 1;
                    this.mode = "context";
                }
                if (e) {
                    e.preventDefault();
                }
            },
            "refresh": function () {
                this.base.pop();
                this.open({
                    "name": "refresh",
                    "path": this.path,
                    "dir":  true,
                });
            },
            "select_all": function (select) {
                // Checkboxes are only dispayed for mode == select.
                // Switching to menu then back to select refreshes
                // the checkboxes. Otherwise their state will be
                // different from what is displayed.
                this.mode = "menu";

                this.base.map(function (dir) {
                    dir.select = select;
                });

                this.mode = "select";
            },
            "details": function (dir) {
                var self = this;
                var path  = this.path;
                var count = this.base.length;
                if (count > 0 && this.base[0].name == "..") {
                    count--;
                }
                if (dir) {
                    path = dir.path;
                    count = -1;
                }

                if (window.resolveLocalFileSystemURL) {
                    window.resolveLocalFileSystemURL(
                        path, function (fileSystem) {
                            fileSystem.getMetadata(
                                function (metadata) {
                                    metadata.count   = count;
                                    self.mode         = "details";
                                    self.details_obj  = metadata;
                                    self.show_context = 1;
                                    self.$forceUpdate();
                                },
                                function (err) {
                                    self.error(err);
                                    self.$forceUpdate();
                                }
                            );
                        }
                    );
                }
            },
            "parseDatetime": function (datetime) {
                function padding(num, len) {
                    var str = "" + num;
                    while (str.length < len) {
                        str = "0" + str;
                    }
                    return str;
                }

                var year   = padding(datetime.getFullYear(), 4);
                var month  = padding(datetime.getMonth() + 1, 2);
                var day    = padding(datetime.getDate(), 2);
                var hour   = padding(datetime.getHours(), 2);
                var minute = padding(datetime.getMinutes(), 2);
                var second = padding(datetime.getSeconds(), 2);

                return year + "-" + month + "-" + day +
                    " " + hour + ":" + minute + ":" + second;
            },
            "parseFileSize": function (size) {
                var sizes = ["B", "KB", "MB", "GB", "TB"];
                var order = 0;
                while (size >= 1024 && order < sizes.length - 1) {
                    order++;
                    size = size / 1024;
                }
                if (order > 0) {
                    size = size.toFixed(3);
                }
                return size + sizes[order];
            },
            "newFolder": function () {
                var self = this;
                var name = prompt("Creat New Folder", "New Folder");

                if (name) {
                    window.resolveLocalFileSystemURL(this.path,
                        function (fileSystem) {
                            fileSystem.getDirectory(
                                name,
                                {
                                    "create":    true,
                                    "exclusive": false
                                },
                                function () {
                                    self.refresh();
                                },
                                function (err) {
                                    self.error(err);
                                }
                            );
                        },
                        this.error
                    );
                }
            },
            "rename": function (dir) {
                var self = this;
                var name = prompt("Rename", dir.name);

                if (name) {
                    var rename = function (file, to, name) {
                        file.moveTo(to, name,
                            function () {
                                self.refresh();
                            },
                            function (err) {
                                self.error(err);
                            }
                        );
                    };

                    var get_filesystem = function (path, callback) {
                        window.resolveLocalFileSystemURL(
                            path,
                            callback,
                            self.error
                        );
                    };
                    
                    get_filesystem(dir.path, function (file) {
                        get_filesystem(self.path, function (par) {
                            rename(file, par, name);
                        });
                    });
                }
                this.show_context = 0;
            },
            "moveStart": function () {
                this.mode = "move_to_dir";
                this.show_context = 0;
            },
            "move": function (dir) {
                var self = this;

                var move = function (file, to) {
                    file.moveTo(to, dir.name,
                        function () {
                            self.refresh();
                        },
                        function (err) {
                            self.error(err);
                        }
                    );
                };

                var get_filesystem = function (path, callback) {
                    window.resolveLocalFileSystemURL(
                        path,
                        callback,
                        self.error
                    );
                };
                
                get_filesystem(dir.path, function (file) {
                    get_filesystem(self.path, function (par) {
                        move(file, par);
                    });
                });
                this.mode = "dir";
                this.show_context = 0;
            },
            "copyStart": function () {
                this.mode = "copy_to_dir";
                this.show_context = 0;
            },
            "copy": function (dir) {
                var self = this;

                var copy = function (file, to) {
                    file.copyTo(to, dir.name,
                        function () {
                            self.refresh();
                        },
                        function (err) {
                            self.error(err);
                        }
                    );
                };

                var get_filesystem = function (path, callback) {
                    window.resolveLocalFileSystemURL(
                        path,
                        callback,
                        self.error
                    );
                };
                
                get_filesystem(dir.path, function (file) {
                    get_filesystem(self.path, function (par) {
                        copy(file, par);
                    });
                });
                this.mode = "dir";
                this.show_context = 0;
            },
            "remove": function (dir) {
                var self = this;
                if (confirm("Delete \"" + dir.name + "\"?")) {
                    window.resolveLocalFileSystemURL(dir.path,
                        function (fileSystem) {
                            var success = function () {
                                self.refresh();
                            };
                            var failure = function (err) {
                                self.error(err);
                            };

                            if (dir.dir) {
                                fileSystem.removeRecursively(
                                    success, failure
                                );
                            } else {
                                fileSystem.remove(
                                    success, failure
                                );
                            }
                        }
                    );

                }
                this.mode = "dir";
                this.show_context = 0;
            },
            /*
            "compress": function (dir) {
                var self = this;
                this.show_context = 0;
            },
            "extract": function (dir) {
                var self = this;
                this.show_context = 0;
            },
            */
        },
    });
    window.app = app;

    document.addEventListener("backbutton", function (e) { 
        e.preventDefault();
        app.back();
    }, false);

    document.addEventListener("deviceready", function () {

        navigator.app.overrideButton("menubutton", true)
        document.addEventListener("menubutton", function (e) {
            e.preventDefault();
            app.mode = "menu";
        }, false);

        app.open({
            "path": "file:///",
            "dir":  true,
            "name": "root",
        });
        app.history.pop();
    }, false);
});
