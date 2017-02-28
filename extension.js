

const Main = imports.ui.main;
//const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
//const GLib = imports.gi.GLib;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gum = imports.gi.Gucharmap;

const MAX_RESULTS = 10;

const iterToArray = i => { let a = []; for (let v of i) a.push(v); return a; }

// TODO: Does this actually achieve anything?
// Taken from Gjs 1.47.4 Promise implementation (Lie)
// Seems to differ blocking until after extensions are loaded
const async = (func, priority=GLib.PRIORITY_DEFAULT_IDLE) => {
    GLib.idle_add(priority, () => {
        func();
        return GLib.SOURCE_REMOVE;
    });
}

const UnicodeSearchProvider = new Lang.Class({
    Name: "UnicodeSearchProvider",
    //Extends: Search.SearchProvider,
    
    _init: function() {
        this.appInfo = Gio.AppInfo.get_default_for_uri_scheme('https');
        
        this.appInfo.get_name = function() {
            return 'Unicode Search Provider'
        }
        this.appInfo.get_icon = function() {
            return Gio.icon_new_for_string(Me.path + '/uni.svg');
        }
        
        // List 'em
        // TODO: Is there a more efficient way to map codepoints?
        this.charmap = new Map();
        async(() => {
            const codepoints = new Gum.ScriptCodepointList();
            //const codepoints = new Gum.BlockCodepointList();
            const scripts = Gum.unicode_list_scripts();
            for (let script of scripts) { codepoints.append_script(script); }
            for (let i = 0; i < codepoints.get_last_index(); i++) {
                try {
                    let codepoint = codepoints.get_char(i);
                    if (Gum.unichar_isdefined(codepoint)) {
                        this.charmap.set(codepoint, Gum.get_unicode_name(codepoint));
                    }
                } catch (error) {
                }
            }
        });
        
        this.resultsMap = new Map();
    },
    _doSearch: function(queryString, callback) {
        async(() => {
            this.resultsMap.clear();
            //let queryString = searchString.split(' ');
            let regstr = '(?=.*' + queryString.join(')(?=.*') +')';
            let query = new RegExp(regstr, 'i');
            
            for (let [char, name] of this.charmap.entries()) {
                if (name.match(query)) { this.resultsMap.set(char, name) }
            }
            callback(iterToArray(this.resultsMap.keys()));
        });
    },
    filterResults: function(results, maximum) {
        return results.slice(0, MAX_RESULTS);
    },
    getInitialResultSet: function(terms, callback, cancellable) {
        this._doSearch(terms, callback);
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
