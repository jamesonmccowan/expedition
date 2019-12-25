$(function () {
    var app = new Vue({
        "el": $("#app")[0],
        "data": {
            "mode": "dir",
            "path": "",
            "filter": "",
            "base": [],
            "demo": {},
            "history": [],
            "position": {"x": 0, "y": 0},
            "bookmark_list": [
                {
                    "dir": true,
                    "name": "Root",
                    "path": "file:///"
                }
            ],

            "loading": false,
            "error_message": "",

            "selected": {"name": ""},
            "multi_selected": [],
            "select_text": "",

            "show_context": 0,
            "compressing": "",
            "show_path_detail": true,
            "font_size": 1,
            "sort": true,
            "sort_dirs": true,
            "details_obj": {},

            "press_timer": 0,
        },
        "methods": {
            "cordova": function (skip_history) {
                this.history.push(this.path);

                try {
                    var files = [];
                    Object.keys(cordova.file).map(function (name) {
                        var path = cordova.file[name];
                        if (path) {
                            files.push({
                                "path": path,
                                "dir":  true,
                                "name": name,
                            });
                        }
                    });
                    this.update_file_list(
                        files, "Cordova", skip_history
                    );
                } catch (e) {
                    this.update_file_list(
                        this.demo.home, "Cordova", skip_history
                    );
                }

                this.loading = false;
                this.error_message = "";
                this.mode = "dir";
            },
            "home": function (skip_history) {
                this.history.push(this.path);

                this.update_file_list(
                    this.bookmark_list, "Home", skip_history
                );

                this.loading = false;
                this.error_message = "";
                this.mode = "dir";
            },
            "add_bookmark": function () {
                var name = prompt(
                    "Creat New Bookmark", this.selected.name
                );

                if (name) {
                    this.bookmark_list.push({
                        "dir": true,
                        "name": name,
                        "path": this.selected.path
                    });
                    this.show_context = 0;
                    this.mode = "dir";
                }
            },
            "update_file_list": function (files, path, skip_history) {
                var self = this;

                if (this.sort) {
                    files.sort(function (a, b) {
                        return a.path > b.path;
                    });
                }
                if (this.sort_dirs) {
                    var dirs = files.filter(function (d) {
                        return d.dir;
                    });
                    files.map(function (d) {
                        if (!d.dir) {
                            dirs.push(d);
                        }
                    });
                    files = dirs;
                }

                // calculate parent directory
                var parts = path.split("/");
                parts.pop();
                parts.pop();

                // record current directory before moving to the next
                if (!skip_history) {
                    this.history.push(this.path);
                }

                // empty file list
                while (this.base.length > 0) {
                    this.base.pop();
                }

                // add parent directory reference
                if (path.match(/^file:\/\/\/./)) {
                    var p = parts.join("/") + "/";
                    this.base.push({
                        "dir":  true,
                        "path": p,
                        "name": "..",
                    });
                }

                // add files to file list
                files.map(function (entry) {
                    self.base.push(entry);
                });

                this.path = path;
                this.loading = false;
                this.$forceUpdate();
            },
            "compare_paths": function (path_a, path_b) {
                var parts_a = path_a
                    .substr("file:///".length).split("/");

                var parts_b = path_b
                    .substr("file:///".length).split("/");

                var ret = {
                    "match":         false,
                    "partial_match": false, // smaller path if subpath
                    "a":             path_a,
                    "b":             path_b,
                    "count":         0,
                };

                // if the paths are the same
                if (path_a == path_b) {
                    ret.match = true;
                    ret.partial_match = path_a;
                } else {

                    // find how similar the two paths are
                    parts_a.map(function (a, i) {
                        if (ret.count == i && a == parts_b[i]) {
                            ret.count++;
                        }
                    });

                    // check that one path is a substring of the other
                    if (ret.count == parts_a.length - 1) {
                        ret.partial_match = path_a;
                    } else if (ret.count == parts_b.length - 1) {
                        ret.partial_match = path_b;
                    }
                }

                // handle special case of one being the root dir
                if (path_a == "file:///" || path_b == "file:///") {
                    ret.partial_match = "file:///";
                }

                return ret;
            },
            "open": function (dir, skip_history) {
                var path = dir.path;
                var self = this;
                if (!dir.dir) {
                    // if it's not a directory, open it as a file
                    // https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-inappbrowser/index.html
                    if (cordova && cordova.InAppBrowser.open) {
                        cordova.InAppBrowser.open(
                            path,
                            "_system"
                        );
                    }
                    return;
                }
                if (path == "") {
                    this.bookmarks();
                    return;
                }

                // get ready for new list of files/dirs
                if (this.path) {
                    this.update_file_list([{
                        "dir":  true,
                        "path": this.path,
                        "name": "..",
                    }], this.path, true);
                }
                this.loading       = true;
                this.error_message = "";
                this.show_context  = 0;

                if (
                    this.mode != "copy_to_dir" &&
                    this.mode != "move_to_dir"
                ) {
                    this.mode = "dir";
                }

                // demo mode
                if (!window.resolveLocalFileSystemURL) {
                    var folders = this.demo.base;
                    var match = false;

                    while (!match) {
                        folders = folders.filter(function (f) {
                            var c = self.compare_paths(f.path, path);

                            if (c.match) {
                                match = f;
                                return true;
                            } else if (c.partial_match == f.path) {
                                return true;
                            }

                            return false;
                        });

                        if (match) {
                            this.update_file_list(
                                match.get || [],
                                match.path,
                                skip_history
                            );
                        } else {
                            if (folders.length > 0) {
                                folders = folders[0].get;
                            } else {
                                this.error({"code": 5});
                                return false;
                            }
                        }
                    }
                    return true;
                }

                // live mode, get directory
                window.resolveLocalFileSystemURL(path, function (fs) {
                    var reader = fs.createReader();
                    reader.readEntries(function (entries) {
                        if (self.loading) {
                            var files = entries.map(function (f) {
                                return {
                                    "dir":  !f.isFile,
                                    "path": f.nativeURL,
                                    "name": f.name,
                                };
                            });

                            self.update_file_list(
                                files, path, skip_history
                            );
                            self.path = path;
                            self.loading = false;
                            self.$forceUpdate();
                        }
                    },
                    function (e) {
                        self.error(e);
                    });
                },
                function (e) {
                    self.error(e);
                });
            },
            "error": function (err) {
                this.loading = false;
                if (err && err.code) {
                    var m = "Error: Unknown Error " + err.code;
                    switch (err.code) {
                        case 1:
                            m = "Error: Not Found";
                            break;

                        case 2:
                            m = "Error: Security";
                            break;

                        case 3:
                            m = "Error: Abort";
                            break;

                        case 4:
                            m = "Error: Not Readable";
                            break;

                        case 5:
                            m = "Error: Encoding";
                            break;

                        case 6:
                            m = "Error: No Modification Allowed";
                            break;

                        case 7:
                            m = "Error: Invalid State";
                            break;

                        case 8:
                            m = "Error: Syntax";
                            break;

                        case 9:
                            m = "Error: Invalid Modification";
                            break;

                        case 10:
                            m = "Error: Quota Exceeded";
                            break;

                        case 11:
                            m = "Error: Type Mismatch";
                            break;

                        case 12:
                            m = "Error: Path Already Exists";
                            break;
                    }

                    this.error_message = m;
                } else {
                    this.error_message = err;
                }
            },
            "back": function () {
                if (this.mode == "dir") {
                    if (this.history.length > 0) {
                        var h = this.history.pop();

                        if (h == "Home") {
                            this.home();
                        } else if (h == "Cordova") {
                            this.cordova();
                        } else {
                            this.open({
                                "dir": true,
                                "path": h,
                                "name": "back",
                            }, true);
                        }
                    }
                } else {
                    this.show_context = 0;
                    this.mode = "dir";
                }

                return false;
            },
            "menuStart": function(event, dir) {
                var self = this;
                this.position.x = event.pageX;
                this.position.y = event.pageY;
                this.press_timer = window.setTimeout(function() {
                    self.openMenu(false, dir);
                }, 1000);
            },
            // used to prevent the menu from opening if
            // the user is scrolling the screen
            "menuMove": function(event) {
                var diffX = this.position.x - event.pageX;
                var diffY = this.position.y - event.pageY;
                var distance = Math.sqrt(
                    diffX * diffX + diffY * diffY
                );

                if (distance >= 5) {
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
                this.open({
                    "name": "refresh",
                    "path": this.path,
                    "dir":  true,
                }, true);
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
            "toggle_selected": function () {
                // Checkboxes are only dispayed for mode == select.
                // Switching to menu then back to select refreshes
                // the checkboxes. Otherwise their state will be
                // different from what is displayed.
                this.mode = "menu";

                this.base.map(function (dir) {
                    dir.select = !dir.select;
                });

                this.mode = "select";
            },

            // list details of a specified file/folder
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
                                    metadata.count    = count;
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
                                function (e) {
                                    self.error(e);
                                }
                            );
                        },
                        function (e) {
                            self.error(e);
                        }
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
                            function (e) {
                                self.error(e);
                            }
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
            "copyMoveStart": function (copy_or_move) {
                var self = this;

                if (this.mode == "select") {
                    this.multi_selected
                        .splice(0, this.multi_selected.length);

                    this.base.map(function (dir) {
                        if (dir.select) {
                            self.multi_selected.push(dir);
                        }
                    });

                    if (this.multi_selected.length > 0) {
                        this.selected = this.multi_selected[0];
                        this.select_text = "files";
                    } else { // nothing to copy/move
                        this.mode = "dir";
                        this.show_context = 0;
                        return;
                    }
                } else {
                    this.multi_selected = [this.selected];
                    this.select_text = this.selected.name;
                }
                this.mode = copy_or_move;
                this.show_context = 0;
            },
            "move": function () {
                var self = this;

                var dirs = this.multi_selected;

                var move = function (file, to, dir) {
                    self.select_text = dir.name;
                    file.moveTo(to, dir.name,
                        function () {
                            self.refresh();
                        },
                        function (e) {
                            self.error(e);
                        }
                    );
                };

                var get_filesystem = function (path, callback) {
                    window.resolveLocalFileSystemURL(
                        path,
                        callback,
                        function (e) {
                            self.error(e);
                        }
                    );
                };

                var count = dirs.length;
                dirs.map(function (dir) {
                    get_filesystem(dir.path, function (file) {
                        get_filesystem(self.path, function (par) {
                            move(file, par, dir);
                            count--;
                            if (count == 0) {
                                self.mode = "dir";
                            }
                        });
                    });
                });
                this.mode = "moving";
                this.show_context = 0;
            },
            "copy": function () {
                var self = this;

                var dirs = this.multi_selected;

                var copy = function (file, to, dir) {
                    self.select_text = dir.name;
                    file.copyTo(to, dir.name,
                        function () {
                            self.refresh();
                        },
                        function (e) {
                            self.error(e);
                        }
                    );
                };

                var get_filesystem = function (path, callback) {
                    window.resolveLocalFileSystemURL(
                        path,
                        callback,
                        function (e) {
                            self.error(e);
                        }
                    );
                };

                var count = dirs.length;
                dirs.map(function (dir) {
                    self.selected = dir;
                    get_filesystem(dir.path, function (file) {
                        get_filesystem(self.path, function (par) {
                            copy(file, par, dir);
                            count--;
                            if (count == 0) {
                                self.mode = "dir";
                            }
                        });
                    });
                });
                this.mode = "copying";
                this.show_context = 0;
            },
            "remove": function (dir) {
                var self = this;

                var dirs = [];
                if (dir) {
                    dirs.push(dir);
                } else {
                    this.base.map(function (dir) {
                        if (dir.select) {
                            dirs.push(dir);
                        }
                    });
                }

                dirs.map(function (dir) {
                    self.selected = dir;
                    if (confirm("Delete \"" + dir.name + "\"?")) {
                        window.resolveLocalFileSystemURL(dir.path,
                            function (fileSystem) {
                                var success = function () {
                                    self.refresh();
                                };
                                var failure = function (e) {
                                    self.error(e);
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
                });

                this.mode = "dir";
                this.show_context = 0;
            },
            "compress": function () {
                var self = this;
                var zip  = new JSZip();
                var name = prompt(
                    "Choose a name for zip archive of \"" +
                    this.selected.name + "\"",
                    this.selected.name + ".zip"
                );
                var count = 0;
                var building = true;

                function buildZip(dir, zip, finish) {
                    count++;
                    var path     = dir.path
                    var subpath  = path.substr(self.path.length);
                    var parts    = path.split("/");
                    var filename = dir.name;
                    parts.pop();
                    var dirName  = parts.join("/");

                    if (!dir.dir) {
						loadFile(
                            dirName,
                            filename,
                            function (data) {
                                self.compressing = filename;
                                zip.file(
                                    decodeURIComponent(subpath),
                                    data,
                                    {"binary": true}
                                );
                                count--;
                                if (count == 0 && !building) {
                                    finish();
                                }
                            }
                        );
                    } else {
                        zip.folder(decodeURIComponent(subpath));
                        getDirFiles(path, function (subdirs) {
                            subdirs.map(function (subdir) {
                                self.compressing = filename;
                                buildZip(subdir, zip, finish);
                            });

                            count--;

                            if (subdirs.length == 0 &&
                                (count == 0 && !building)
                            ) {
                                finish();
                            }
                        });
                    }
                }

                function getDirFiles(path, callback) {
                    window.resolveLocalFileSystemURL(
                        path,
                        function (fs) {
                            var reader = fs.createReader();
                            reader.readEntries(function (files) {
                                callback(files.map(function (f) {
                                    return {
                                        "dir":  !f.isFile,
                                        "path": f.nativeURL,
                                        "name": f.name,
                                    };
                                }));
                            },
                            function (e) {
                                self.error(e);
                            });
                        },
                        function (e) {
                            self.error(e);
                        }
                    );
                }

                function getDir(dirName, callback) {
                    window.resolveLocalFileSystemURL(
                        dirName,
                        callback,
                        function (e) {
                            self.error(e)
                        }
                    );
                }

                function getFile(dir, filename, callback) {
                    dir.getFile(
                        filename,
                        {"create": true, "exclusive": false},
                        callback,
                        function (e) {
                            self.error(e)
                        }
                    );
                }

                function writeFile(file, blob, callback) {
                    file.createWriter(function (writer) {
                        writer.write(blob);
                        callback();
                    }, function (e) {
                        self.error(e)
                    });
                }

                function readFile(fileEntry, callback) {
                    fileEntry.file(function (file) {
                        var reader = new FileReader();
                        reader.onloadend = function (evt) {
                            callback(evt.target.result);
                        };
                        reader.readAsBinaryString(file);
                    }, function (e) {
                        self.error(e)
                    });
                }

                function saveFile(blob, dirName, filename, callback) {
                    getDir(dirName, function (dir) {
                        getFile(dir, filename, function (file) {
                            writeFile(file, blob, function () {
                                callback();
                                // do something after saving
                            });
                        });
                    });
                }

                function loadFile(dirName, filename, callback) {
                    getDir(dirName, function (dir) {
                        getFile(dir, filename, function (file) {
                            readFile(file, callback);
                        });
                    });
                }

                function finish () {
                    if (!finished) {
                        finished = true;
                        zip.generateAsync({"type": "blob"})
                            .then(function (blob) {
                                saveFile(
                                    blob,
                                    self.path,
                                    name,
                                    function () {
                                        alert(
                                            "Finished creating \"" +
                                            name +
                                            "\"!"
                                        );
                                        self.show_context = 0;
                                        self.refresh();
                                    }
                                );
                            });
                    }
                }

                if (name) {
                    var finished = false;
                    this.mode = "compressing";
                    this.compressing = name;

                    buildZip(this.selected, zip, finish);
                    building = false;
                    if (count == 0 && !finished) {
                        finish();
                    }
                } else {
                    this.show_context = 0;
                }
            },
            "extract": function () {
                var self = this;

                function getDir(dirName, callback) {
                    window.resolveLocalFileSystemURL(
                        dirName,
                        callback,
                        function (e) {
                            self.error(e)
                        }
                    );
                }

                function getFile(dir, filename, callback) {
                    dir.getFile(
                        filename,
                        {"create": true, "exclusive": false},
                        callback,
                        function (e) {
                            self.error(e)
                        }
                    );
                }

                function readFile(fileEntry, callback) {
                    fileEntry.file(function (file) {
                        var reader = new FileReader();
                        reader.onloadend = function (evt) {
                            callback(evt.target.result);
                        };
                        reader.readAsArrayBuffer(file);
                    }, function (e) {
                        self.error(e)
                    });
                }

                function writeFile(file, blob, callback) {
                    file.createWriter(function (writer) {
                        writer.write(blob);
                        callback();
                    }, function (e) {
                        self.error(e)
                    });
                }

                function readZip(dir, callback) {
                    var dirName = self.path;
                    var filename = dir.name;

                    getDir(dirName, function (dir) {
                        getFile(dir, filename, function (file) {
                            readFile(file, function (data) {
                                var promise = JSZip.loadAsync(data);
                                promise.then(
                                    callback,
                                    function (e) {
                                        self.error(e)
                                    }
                                );
                            });
                        })
                    });
                }

                function saveFile(blob, zipName, callback) {
                    var filepath = self.path + zipName;

                    var parts = filepath.split("/");
                    parts.pop();

                    var dirName = parts.join("/");

                    getDir(dirName, function (dir) {
                        getFile(dir, zipName, function (file) {
                            writeFile(file, blob, function () {
                                callback();
                            });
                        });
                    });
                }

                function fileSort(a, b) {
                    var ret = false;
                    if (
                        a.charAt(a.length - 1) === "/" &&
                        b.charAt(b.length - 1) === "/"
                    ) {
                        ret = a > b;
                    } else {
                        if (
                            a.charAt(a.length - 1) === "/" &&
                            b.charAt(b.length - 1) !== "/"
                        ) {
                            ret = false;
                        } else if (
                            a.charAt(a.length - 1) !== "/" &&
                            b.charAt(b.length - 1) === "/"
                        ) {
                            ret = true;
                        } else {
                            ret = a > b;
                        }
                    }
                    return ret;
                }

                function unzip(dir, callback) {
                    readZip(dir, function (zip) {
                        var keys = Object.keys(zip.files)
                            .sort(fileSort);

                        keys = keys.filter(function (key) {
                            return key.charAt(key.length - 1) !== "/";
                        });


                        var count = keys.length;
                        if (count == 0) {
                            callback();
                        }

                        keys.map(function (key) {
                            zip.files[key].async("string")
                                .then(function (value) {
                                    blob = value; // new Blob(value);
                                    self.compressing = key;
                                    saveFile(blob, key, function () {
                                        count--;
                                        if (count == 0) {
                                            callback();
                                        }
                                    });
                                });
                        });
                    });
                }

                if (
                    !this.selected.dir &&
                    confirm("Extract \"" + this.selected.name + "\"?")
                ) {
                    this.mode = "extracting";
                    this.compressing = this.selected.name;

                    unzip(this.selected, function () {
                        alert(
                            "Finished extracting \"" +
                            self.selected.name +
                            "\"!"
                        );
                        self.show_context = 0;
                        self.refresh();
                    });
                } else {
                    this.show_context = 0;
                }
            },
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

    $.get("js/demo.json", function (data) {
        app.demo.home = data.home;
        app.demo.base = data.base;
    });
});
