

const Main = imports.ui.main;
//const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

const Self = imports.misc.extensionUtils.getCurrentExtension();

const MAX_RESULTS = 10;

const UnicodeSearchProvider = new Lang.Class({
    Name: "UnicodeSearchProvider",
    //Extends: Search.SearchProvider,
    
    _init: function() {
        this.appInfo = Gio.AppInfo.get_default_for_uri_scheme('https');
        
        this.appInfo.get_name = function() {
            return 'Unicode Search Provider'
        }
        this.appInfo.get_icon = function() {
            return Gio.icon_new_for_string(Self.path + '/uni.svg');
        }
        
        this.resultsMap = new Map();
    },
    _doSearch: function(queryString, callback, cancellable) {
        this.resultsMap.clear();
        
        this.cancellable = new Gio.Cancellable();
        
        let file = Self.path + '/NamesList.txt';
        // Get all lines starting with codepoints
        //let grep = ['/bin/grep', file, '-e', "$'^[0-9,A-F]*\t'"]
        //let grep = ['/bin/grep', file, '-e', '^[0-9,A-F]\\{1,6\\}\t']
        //let grep = ['/bin/grep', file, '-E', '^[0-9,A-F]\*\t']
        let grep = ['/bin/cat', file]
        //grep = grep.concat(['|', '/bin/grep', '-e', '^[0-9,A-F]\\{1,6\\}\t'])
        for (let q of queryString) {
            grep = grep.concat(['|', '/bin/grep', '-ie', q])
        }
        const [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(null, ['/bin/sh', '-c', grep.join(' ')], null, 0, null);
        const out_reader = new Gio.DataInputStream({
          base_stream: new Gio.UnixInputStream({fd: out_fd})
        });
        // TODO: Cancellable
        const yolo = (source_object, res) => {
            const [out, length] = out_reader.read_line_finish_utf8(res);
            if (out !== null) {
                let d = out.split('\t');
                let cp = parseInt(d[0], 16);
                if (!isNaN(cp)) {
                    let char = String.fromCodePoint(cp);
                    let desc = d[1].trim();
                    print(d[0bus], "\t: ", char, "\t: ", desc);
                    this.resultsMap.set(char, desc);
                    callback(Array.from(this.resultsMap.keys()))
                }
                if (this.resultsMap.size > MAX_RESULTS) {
                    cancellable.cancel();
                    GLib.spawn_close_pid(pid);
                }
                out_reader.read_line_async(GLib.PRIORITY_LOW, cancellable, yolo);
            } else {
                callback(Array.from(this.resultsMap.keys()));
            }
        };
        out_reader.read_line_async(GLib.PRIORITY_LOW, cancellable, yolo);
    },
    filterResults: function(results, maximum) {
        return results.slice(0, MAX_RESULTS);
    },
    getInitialResultSet: function(terms, callback, cancellable) {
        this._doSearch(terms, callback, cancellable);
        return [];
    },
    getSubsearchResultSet: function(previousResults, terms, callback, cancellable) {
        return this.getInitialResultSet(terms, callback, cancellable);
    },
    _getResultMeta: function(resultId) {
        return {
            id: resultId,
            name: resultId,
            createIcon: function() {
                // TODO: Character as icon?
                // SVG of glyphs?
            },
            description: this.resultsMap.get(resultId),
        }
    },
    getResultMetas: function(resultIds, callback) {
        let metas = [];
        for (let resultId of resultIds) {
            metas.push(this._getResultMeta(resultId));
        }
        callback(metas);
    },
    activateResult: function(result) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, result);
    },
    launchSearch: function(terms) {
        Util.trySpawnCommandLine('gucharmap "' + terms + '"');
    },
});

let unicodeSearchProvider = null;

function init() {}

function enable() {
    if (!unicodeSearchProvider) {
        unicodeSearchProvider = new UnicodeSearchProvider();
        Main.overview.viewSelector
            ._searchResults._registerProvider(unicodeSearchProvider);
    }
}

function disable() {
    if (unicodeSearchProvider) {
        Main.overview.viewSelector
            ._searchResults._unregisterProvider(unicodeSearchProvider);
        unicodeSearchProvider = null;
    }
}
