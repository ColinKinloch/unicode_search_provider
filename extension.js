
const Main = imports.ui.main;
const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gum = imports.gi.Gucharmap;

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
            return Gio.icon_new_for_string(Me.path + '/uni.svg');
        }
        
        // List 'em
        //TODO: This is far too slow for startup 
        this.charmap = new Map();
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
        
        this.resultsMap = new Map();
    },
    _doSearch: function(queryString, callback) {
        this.resultsMap.clear();
        //let queryString = searchString.split(' ');
        let regstr = '(?=.*' + queryString.join(')(?=.*') +')';
        let query = new RegExp(regstr, 'i');
        
        for (let [char, name] of this.charmap.entries()) {
            if (name.match(query)) { this.resultsMap.set(char, name) }
        }
        callback(this.resultsMap.keys())
    },
    filterResults: function(results, maximum) {
        log(results)
        let r = [];
        for (let result of results) {
            r.push(result);
        }
        return r.slice(0, MAX_RESULTS);
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
            createIcon: function() {},
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
        
    },
});

let unicodeSearchProvider = null;

function init() {
    log("Yolo");
}

function enable() {
    log("Yello");
    if (!unicodeSearchProvider) {
        unicodeSearchProvider = new UnicodeSearchProvider();
        Main.overview.viewSelector._searchResults._registerProvider(unicodeSearchProvider);
    }
}

function disable() {
    if (unicodeSearchProvider) {
        Main.overview.viewSelector._searchResults._unregisterProvider(unicodeSearchProvider);
        unicodeSearchProvider = null;
    }
}
