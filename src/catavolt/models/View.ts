import { Menu } from './Menu';
import { ViewType } from './types';

/**
 * A View represents a Catavolt 'Pane' definition.  A Pane can be thought of as a 'panel' or UI component
 * that is responsible for displaying a data record or records. The Pane describes 'how' and 'where' the data will be
 * displayed, as well as surrounding 'meta' data (i.e. the Pane title, the Pane's menus).  The Pane itself does not contain
 * the record or records to be displayed, but may be combined with a {@link Record}(s) to display the data.
 */
export abstract class View {
    /* From View */
    public readonly alias: string;
    public readonly defaultActionId: string;
    public readonly id: string;
    public readonly name: string;
    public readonly menu: Menu;
    public readonly title: string;
    public readonly type: ViewType;

    /* @TODO Leftover from PaneDef */

    /*
    readonly label:string;
    readonly viewDescs:Array<ViewDesc>;
    readonly recordDef:RecordDef;
    readonly dialogRedirection:DialogRedirection;
    readonly settings:StringDictionary;
    */

    /**
     * Find the title for this Pane
     * @returns {string}
     */
    public findTitle(): string {
        let result: string = this.title ? this.title.trim() : '';
        result = result === 'null' ? '' : result;
        if (result === '') {
            result = this.title ? this.title.trim() : '';
            result = result === 'null' ? '' : result;
        }
        return result;
    }

    /**
     * Find a menu def on this View with the given actionId
     * @param actionId
     * @returns {Menu}
     */
    public findMenuAt(actionId: string): Menu {
        if (this.menu) {
           return this.menu.findAtActionId(actionId);
        }
        return null;
    }
}
