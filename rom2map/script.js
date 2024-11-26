jQuery(function($) {
    InjectStylesheet();
    
    const UNIT = 4;
    const GROUP = 2;
    const BUILDING = 9;
    const PLAYER = 3;

    $('#load_map').click(() => LoadNewMap($('#definition').val()));
    $('#debug_tiles').click(DebugTiles);
    $('#tile_size').change(ChangeTileSize);

    $(document).on('click', '.thing', function() {
        const thing = $(this);
        if (thing.data('id') === undefined) {
            return;
        }
        const mark_id = `mark-${thing.data('type')}-${thing.data('id')}`;

        const existing_mark = $(`#${mark_id}`);

        if (existing_mark.length) {
            existing_mark.remove();
            $(`#description li.${mark_id}`).remove();
            RedrawMarks();
            return;
        }

        const symbol = String.fromCharCode(0x278A + $('.mark').length);
        $('#overlay').append($('<span class="mark"/>')
            .attr({id: mark_id})
            .text(symbol)
            .css('left', `calc(${thing.data('x')}px * var(--tile-size) - 20px)`)
            .css('top', `calc(${thing.data('y')}px * var(--tile-size) - 20px)`)
        );

        const description = thing.clone().addClass(mark_id).data(thing.data());
        description.find('.item').hide();
        $('#description').append(description);
    });

    if (localStorage.tile_size) {
        $('#tile_size').val(localStorage.tile_size).change();
    }
    
    $('#input_submit').click(() => {
        var formData = new FormData();
        formData.append('file', $('#input_alm')[0].files[0]);

        $('#loading').html('<span class="aui-icon aui-icon-small aui-iconfont-upload" role="img"/>');

        $.ajax({
            url: 'https://zxf63t213b.execute-api.eu-north-1.amazonaws.com/default/rom2-alm-parser?mode=alm_to_json',
            type: 'POST',
            data: formData,
            processData: false,  // tell jQuery not to process the data
            contentType: false,  // tell jQuery not to set contentType
            error: () => {
                alert('Failed to process the file :(');
                $('#loading').html('<span class="aui-icon aui-icon-small aui-iconfont-error" role="img"/>');
            },
            success: (data) => {
                LoadNewMap(data);
                $('#loading').html('<span class="aui-icon aui-icon-small aui-iconfont-check-circle-filled" role="img"/>');
            },
        });

        return false;
    });

    if (localStorage.map) {
        setTimeout(() => LoadMap(JSON.parse(localStorage.map)), 0);
    }

    $('.filter').click((e) => {
        const t = $(e.target).closest('button');
        const now_enabled = t.hasClass('aui-button-subtle');
        t.toggleClass('aui-button-subtle', !now_enabled);
        t.find('.aui-icon').toggleClass('aui-iconfont-cross', !now_enabled).toggleClass('aui-iconfont-check', now_enabled);
        ApplyThingFilter();
    });

    $('.filter').each((_, el) => {
        const t = $(el);
        const icon = t.hasClass('aui-button-subtle') ? 'aui-iconfont-cross' : 'aui-iconfont-check';
        t.prepend($('<span class="aui-icon aui-icon-small" role="img"/>').addClass(icon));
    });

    $(document).on('tabSelect', ApplyThingFilter);

    ApplyThingFilter();

    function ApplyThingFilter() {
        const filter = $('.filter:visible:not(.aui-button-subtle)')
            .map((_, x) => $(x).data('filter'))
            .toArray()
            .join(',');

        let shown = 0;
        const total = $('#things .active-pane .thing').each((_, thing) => {
            const show = $(thing).is(filter);
            $(thing).toggle(show);
            if (show) {
                shown++;
            }
        }).length;
        $('#things_footer').text(`Showing ${shown}/${total} things`);
    }

    function RedrawMarks() {
        $('.mark').each((i, e) => {
            const el = $(e);
            const symbol = String.fromCharCode(0x278A + i);
            el.text(symbol);
        });
    }

    function LoadNewMap(definition) {
        const map = JSON.parse(definition);
        $('#definition').val('');

        // We don't need the never-rendered border of 8 tiles in all directions.
        const tiles = [];
        let i = 0;
        for (let y = 0; y < map.info.height; ++y) {
            for (let x = 0; x < map.info.width; ++x) {
                if (7 < x && x < map.info.width - 8 && 7 < y && y < map.info.height - 8) {
                    tiles.push(map.tiles[i]);
                }
                ++i;
            }
        }

        if (i != map.tiles.length) {
            alert('broken map: tiles total != width * height');
            return;
        }

        map.tiles = tiles;
        map.info.width -= 16;
        map.info.height -= 16;

        localStorage.map = JSON.stringify(map);
        return LoadMap(map);
    }

    function LoadMap(map) {
        $('#map_name').text(`${map.info.map_name} --- ${map.info.width}x${map.info.height}`);

        const height = map.info.height;
        const width = map.info.width;

        let tiles = [].concat(map.tiles).reverse();
        const minimap = $('#minimap').html('');
        for (let y = 0; y < height; ++y) {
            let row = $('<div class="row"/>');
            for (let x = 0; x < width; ++x) {
                row.append($('<tile/>').addClass('tile-' + (tiles.pop() & 0xFFF)));
            }
            minimap.append(row);
        }

        const referenced = {4: [], 2: [], 9: [], 3: []};

        for (let check of [].concat(Object.values(map.checks), Object.values(map.instances))) {
            for (let i in check.arg_type) {
                if ([UNIT, GROUP, BUILDING, PLAYER].includes(check.arg_type[i])) {
                    referenced[check.arg_type[i]].push(check.arg_value[i]);
                }
            }
        }

        const groups = {};
        for (let group of map.groups) {
            groups[group.group_id] = group;
        }

        RenderThings(map, referenced, groups);
        ApplyThingFilter();
    }

    function RenderThings(map, referenced, groups) {
        const things_units = $('#things_units').html('');
        for (let unit of map.units) {
            const {text, thing_class, data, items} = RenderUnit(map, unit, referenced, groups);
            things_units.append($('<li class="thing"/>').html(text).data(data).addClass(thing_class).append(items));
        }
        
        const units_in_group = {};
        for (let unit of map.units) {
            if (!units_in_group[unit.group_id]) {
                units_in_group[unit.group_id] = [];
            }
            units_in_group[unit.group_id].push(unit);
        }

        const things_groups = $('#things_groups').html('');
        for (let group of Object.values(groups)) {
            const {text, thing_class, data} = RenderGroup(map, group, referenced, units_in_group[group.group_id]);
            things_groups.append($('<li class="thing"/>').html(text).data(data).addClass(thing_class));
        }

        const things_buildings = $('#things_buildings').html('');
        for (let building of map.buildings) {
            const {text, thing_class, data} = RenderBuilding(map, building, referenced);
            things_buildings.append($('<li class="thing"/>').html(text).data(data).addClass(thing_class));
        }

        const things_logic = $('#things_logic').html('');
        for (let trigger of map.triggers) {
            const {text, thing_class} = RenderLogic(map, trigger);
            things_logic.append($('<li class="thing"/>').html(text).addClass(thing_class));
        }

        const buildings = {};
        for (let building of map.buildings) {
            buildings[building.building_id] = building;
        }

        const things_effects = $('#things_effects').html('');
        for (let [index, effect] of Object.entries(map.effects)) {
            if (effect.x == 0 || effect.y == 0) {
                continue; // That's an effect imbued on an item.
            }
            const {text, thing_class, data} = RenderEffect(map, index, effect, buildings);
            things_effects.append($('<li class="thing"/>').html(text).addClass(thing_class).data(data));
        }
    }

    function RenderUnit(map, unit, referenced, groups) {
        let thing_class = '';
        let extra = '';

        d = map.players[0].diplomacy[unit.player_id - 1];
        if (d & 0x2) {
            extra += ' (ally)';
            thing_class += ' ally';
        } else if (!(d & 0x1)) {
            extra += ' (neutral)';
            thing_class += ' neutral';
        }
        
        let ref_text = '';
        if (referenced[UNIT].includes(unit.unit_id)) {
            ref_text = 'unit';
            thing_class += ' referenced_unit';
        }
        if (referenced[GROUP].includes(unit.group_id)) {
            if (ref_text) {
                ref_text += '+';
            }
            ref_text += 'group';
            thing_class += ' referenced_group';
        }

        if (ref_text) {
            ref_text = `, referenced ${ref_text}`;
        }
        
        let bag = [];
        if (1 < unit.bag_id && unit.bag_id - 1 < map.bags.length) {
            bag = map.bags[unit.bag_id - 1].items;

            if (bag.length) {
                thing_class += ' with_bag';
            }
        }

        const no_exp = (unit.more_flags & 0x8) != 0;
        if (no_exp) {
            extra += ', no_exp';
        }

        let {add_class, items} = RenderUnitItems(map, bag, no_exp);
        thing_class += add_class;

        const group = groups[unit.group_id];
        const group_info = [];
        if (group) {
            group_info.push(`repop=${group.repop_time}`);
            if (group.flags) {
                group_info.push(`gflags=${group.flags}`);
            }
        }
        let group_info_str = '';
        if (group_info.length) {
            group_info_str = ` (${group_info.join(', ')})`;
        }

        const flags_str = unit.more_flags ? `, flags=${unit.more_flags}` : '';
        
        let hp = '';
        if (unit.hp != 65535 || unit.max_hp != 65535) {
            hp = ` hp=${unit.hp}/${unit.max_hp}`;
            thing_class += ' hp';
        }

        const text = `${engine_data.unit_kinds[unit.server_id].name} at x=${unit.x}, y=${unit.y}: ID=${unit.unit_id}${flags_str}${extra}, group=${unit.group_id}${group_info_str}${hp}${ref_text}`;
        const data = {type: 'unit', id: unit.unit_id, x: unit.x-8, y: unit.y-8};

        return {text, thing_class, data, items};
    }

    function RenderUnitItems(map, bag, no_exp) {
        let has_wield = false, has_drop = false;
        let rendered_items = $('<div class="container"/>');

        if (!no_exp) {
            const items = {0: {}, 1: {}}; // (is wielded?) -> full item string -> count.

            for (let item of bag) {
                if (item.wielded) {
                    has_wield = true;
                } else {
                    has_drop = true;
                }

                let item_str = `${engine_data.item_names[item.item_id]} (${item.item_id})`;
                if (item.effect > 0) {
                    const effect = map.effects[item.effect - 1];
                    if (effect.spell_type_id != 0) {
                        item_str += ' of ' + Spell(effect.spell_type_id, effect.spell_power);
                    }

                    if (effect.modifiers.length) {
                        const keys_in_order = [];
                        const moddict = {};
                        for (let modifier of effect.modifiers) {
                            if (!(modifier.x in moddict)) {
                                keys_in_order.push(modifier.x);
                                moddict[modifier.x] = 0;
                            }
                            moddict[modifier.x] += modifier.y;
                        }
                        
                        let modstr = '';
                        for (let k of keys_in_order) {
                            modstr += ` ${engine_data.item_modifiers[k]}=${moddict[k]}`;
                        }
                        if (modstr) {
                            item_str += ` with${modstr}`;
                        }
                    }
                }
                items[item.wielded][item_str] = (items[item.wielded][item_str] || 0) + 1;
            }

            for (let wielded of [0, 1]) {
                const drops_or_wields = wielded ? 'wields' : 'drops';
                
                const keys = Object.keys(items[wielded]);
                keys.sort();
                
                for (let item_str of keys) {
                    const count = items[wielded][item_str];
                    const count_str = count > 1 ? `${count}x ` : '';
                    rendered_items.append($('<div class="item"/>').text(`${drops_or_wields} ${count_str}${item_str}`));
                }
            }
        }

        let add_class = '';
        if (has_drop) {
            add_class = ' drop';
        }
        if (has_wield) {
            add_class += ' wield';
        }

        if (rendered_items.length === 0) {
            rendered_items = '';
        }

        return {add_class, items: rendered_items};
    }

    function RenderGroup(map, group, referenced, units) {
        let x = 0, y = 0;
        for (let unit of units) {
            x += unit.x - 8;
            y += unit.y - 8;
        }
        const data = {type: 'group', id: group.group_id, x: x / units.length, y: y / units.length};

        let thing_class = 'thing';
        let extra = '';

        if (referenced[GROUP].includes(group.group_id)) {
            thing_class += ' referenced_group';
            extra += ', referenced';
        }

        const text = `Group ${group.group_id} with ${units.length} mobs, player ${units[0].player_id}, repop ${group.repop_time}${extra}`;

        return {text, thing_class, data};
    }

    function RenderBuilding(map, building, referenced) {
        const is_bridge = building.type_id & 0x1000000;
        const kind = engine_data.building_kinds[(building.type_id & ~0x1000000) - 1];

        const x = building.x - 8 + kind.size_x / 2;
        const y = building.y - 8 + kind.size_y / 2;

        const data = {type: 'group', id: building.building_id, x: x, y: y};

        let thing_class = 'thing';
        let extra = '';

        if (is_bridge) {
            thing_class += ' bridge';
            extra += `, width=${building.bridge_width}, height=${building.bridge_height}`;
        }

        if (referenced[BUILDING].includes(building.building_id)) {
            thing_class += ' referenced_building';
            extra += ', referenced';
        }

        const text = `${kind.name} (id=${building.building_id}) at x=${building.x}, y=${building.y}, player ${building.player}${extra}`;

        return {text, thing_class, data};
    }

    function RenderLogic(map, trigger) {
        const check = (i) => RenderCheck(map, trigger.check_ids[i]);
        const cmps = ['=', '!=', '>', '<', '>=', '<='];

        const once = trigger.execute_once ? ' (once)' : '';

        let result = $('<div/>').html(`Trigger "${trigger.name}"${once}:`);

        let conditions = [];
        if (trigger.check_ids[0] && trigger.check_ids[1]) {
            conditions.push(` ${check(0)} ${cmps[trigger.check_operators[0]]} ${check(1)}`);
        }
        if (trigger.check_ids[2] && trigger.check_ids[3]) {
            conditions.push(` ${check(2)} ${cmps[trigger.check_operators[1]]} ${check(3)}`);
        }
        if (trigger.check_ids[4] && trigger.check_ids[5]) {
            conditions.push(` ${check(4)} ${cmps[trigger.check_operators[2]]} ${check(5)}`);
        }
        let conditions_li = $('<li/>').text('if ' + conditions.join(' AND '));

        let instances = []
        for (let instance_id of trigger.instance_ids) {
            if (instance_id) {
                instances.push(RenderInstance(map, instance_id));
            }
        }
        let instances_li = $('<li/>').text('then ' + instances.join(' AND '));

        const text = result.append($('<ul/>').html(conditions_li).append(instances_li));
        let thing_class = '';

        return {text, thing_class};
    }

    const checks = {
        0: ()     => `(!broken check: type_id = 0)`,
        1: (args) => `count_units(group=${args[0]})`,
        2: (args) => `is_unit_in_box(${args[0]}, left=${args[1]}, top=${args[2]}, right=${args[3]}, bottom=${args[4]})`,
        3: (args) => `is_unit_in_circle(${args[0]}, x=${args[1]}, y=${args[2]}, radius=${args[3]})`,
        4: (args) => {
            if (args[1] != 6) {
                return `(unhander check of type 4: args[1] = ${args[1]} != 6)`;
            }
            return `unit_health(${args[0]})`;
        },
        5: (args)  => `unit_alive(${args[0]})`,
        19: (args) => `variable(${args[0]})`,
        21: (args) => `building_health(${args[0]})`,
        65538: (args) => args[0],
    };

    function RenderCheck(map, check_id) {
        const c = map.checks[check_id];
        if (c === undefined) {
            return `(!broken check: ${check_id})`;
        }
        const func = checks[c.type_id];
        if (func === undefined) {
            return `(!unhandled check type: ${c.type_id})`;
        }
        return func(c.arg_value);
    }

    const instances = {
        0: ()     => `(!broken instance: type_id = 0)`,
        1: ()     => `increment_mission_stage()`,
        2: (args) => `send_message(message=${args[0]})`,
        3: (args) => `variable_${args[0]} := ${args[1]}`,
        4: ()     => `complete_mission()`,
        5: (args) => `fail_mission(reason=${args[0]})`,
        6: (args) => {
            const command = {
                1: (args)  => `command=guard, guard_range=${args[1]}`,
                2: (args)  => `command=swarm, x=${args[1]}, y=${args[2]}`,
                3: ()      => `command=stand_ground`,
                4: (args)  => `command=move, x=${args[1]}, y=${args[2]}`,
                5: (args)  => `command=swarm2, x=${args[1]}, y=${args[2]}`,
                10: (args) => `command=attack, target_unit=${args[1]}`,
                11: (args) => `command=defend, target_unit=${args[1]}, follow_range=${args[2]}`,
                14: (args) => `command=patrol, x=${args[1]}, y=${args[2]}`,
            }[args[0]];
            if (!command) {
                return `(!unhandled group command: args=${args})`;
            }
            return `group_command(group=${args[9]}, ${command(args)})`;
        },
        7: (args)  => `set_formation(player=${args[0]}, formation=${args[1]})`,
        8: (args)  => `variable_${args[0]}++`,
        9: (args)  => `change_diplomacy(from_player=${args[0]}, to_player=${args[1]}, diplomacy=${args[2]})`,
        16: (args) => `hide_unit(${args[0]})`,
        17: (args) => `show_unit(${args[0]})`,
        18: (args) => `polymorph_unit(${args[0]}, as=${args[1]})`,
        19: (args) => `change_unit_owner(unit=${args[0]}, new_owner=${args[1]})`,
        21: (args) => `cast ${Spell(args[4], args[5])} from (${args[0]}, ${args[1]}) to (${args[2]}, ${args[3]})`,
        22: (args) => `change_group_owner(group=${args[0]}, new_owner=${args[1]})`,
        25: (args) => `create_trigger(${Spell(args[0], args[1])}, trigger=(${args[2]}, ${args[3]}), from=(${args[4]}, ${args[5]}), to=(${args[6]}, ${args[7]}))`,
        24: (args) => `cast ${Spell(args[3], args[4])} from (${args[0]}, ${args[1]}) to unit ${args[2]}`,
        27: (args) => `move_unit(${args[0]}, x=${args[1]}, y=${args[2]})`,
        28: (args) => `give_all(from_unit=${args[0]}, to_unit=${args[1]})`,
        30: (args) => `cast(${Spell(args[1], 0)}, unit=${args[0]}, duration=${args[2]})`,
        32: (args) => `hide_group(${args[0]})`,
        33: (args) => `show_group(${args[0]})`,
        34: (args) => {
            if (args[1] != 6) {
                return `(!unhandled instance of type 34: args[1] = ${args[1]} != 6)`;
            }
            return `unit_health(${args[0]}) := ${args[2]}`;
        },
        38: (args) => `remove_item_from_everyone(item=${args[0]})`,
        65538: (args) => `start_location(x=${args[0]}, y=${args[1]})`,
    };

    function RenderInstance(map, instance_id) {
        const c = map.instances[instance_id];
        if (c === undefined) {
            return `(!broken instance: ${instance_id})`;
        }
        const func = instances[c.type_id];
        if (func === undefined) {
            return `(!unhandled instance type: ${c.type_id})`;
        }
        return func(c.arg_value);
    }

    function RenderEffect(map, index, effect, buildings) {
        // The effects are reused between on-item effects and on-map traps,
        // and they use the same fields for different things.
        const flags = effect.magic_type;
        const building_id = flags == 4 ? effect.max_magic_damage * 256 + effect.min_magic_damage : 0;

        let text = '';
        let thing_class = '';
        const data = {type: 'effect', id: index, x: effect.x, y: effect.y};

        if (effect.spell_type_id == 23) {
            thing_class += ' teleport';
        }

        if (effect.spell_type_id) {
            text = `${Spell(effect.spell_type_id, effect.spell_power)} `;
        }

        text += `at x=${effect.x}, y=${effect.y}`;
        
        const building = buildings[building_id];

        if (building_id) {
            text += ` at range=${effect.range}`;
            if (!building) {
                text += ` [from missing building ${building_id}]`;
            } else {
                thing_class += ' from-building';

                const player = map.players[building.player - 1];
                text += ` from building ${building_id} - ${DiplomacyTitle(player.diplomacy[0])} player ${building.player}`;

                if (player.diplomacy[0] & 0x2) {
                    thing_class += ' from-ally-building';
                }
            }
        } else {
            thing_class += ' trap';
        }

        if (effect.modifiers.length != 0 && effect.modifiers.length != 2) {
            text += ` (!weird modifiers: ${effect.modifiers} of length ${effect.modifiers.length}, want 0 or 2)`;
        }

        if (effect.modifiers.length == 2) {
            const [_from, _to] = effect.modifiers;
            text += ` from (${_from.x}, ${_from.y}) to (${_to.x}, ${_to.y})`;
        }

        return {text, thing_class, data};
    }
    
    function Spell(spell_id, power) {
        if (!spell_id) {
            return '';
        }
        const spell = engine_data.spell_names[spell_id - 1];
        return power ? spell + ` at level ${power}` : spell;
    }

    function DiplomacyTitle(d) {
        const suffix = (d & 0x10) ? '+view' : '';
        if (d & 0x1) {
            return 'enemy' + suffix;
        }
        if (d & 0x2) {
            return 'friend' + suffix;
        }
        return 'neutral' + suffix;
    }

    function ChangeTileSize() {
        localStorage.tile_size = $('#tile_size').val();
        document.documentElement.style.setProperty('--tile-size', localStorage.tile_size);
    }

    function InjectStylesheet() {
        let all_tile_types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 432, 433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443, 444, 445, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 512, 513, 514, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 535, 544, 545, 546, 547, 548, 549, 550, 551, 560, 561, 562, 563, 564, 565, 566, 567, 576, 577, 578, 579, 580, 581, 582, 583, 592, 593, 594, 595, 596, 597, 598, 599, 608, 609, 610, 611, 612, 613, 614, 615, 624, 625, 626, 627, 628, 629, 630, 631, 640, 641, 642, 643, 644, 645, 646, 647, 656, 657, 658, 659, 660, 661, 662, 663, 672, 673, 674, 675, 676, 677, 678, 679, 688, 689, 690, 691, 692, 693, 694, 695, 704, 705, 706, 707, 708, 709, 710, 711, 720, 721, 722, 723, 724, 725, 726, 727, 736, 737, 738, 739, 740, 741, 742, 743, 752, 753, 754, 755, 756, 757, 758, 759, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 784, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 816, 817, 818, 819, 820, 821, 822, 823, 824, 825, 826, 827, 828, 829, 538, 539, 543, 716, 747];
        all_tile_types.sort(function(a, b) {
            return a - b;
        });

        let stylesheet = [];

        for (let y = 0; y < 22; ++y) {
            for (let x = 0; x < 30; ++x) {
                const t = all_tile_types.shift();
                if (t !== undefined) {
                    stylesheet.push(`.tile-${t} { background-position: ${100*x/29}% ${100*y/21}% }`);
                }
            }
        }

        var style = document.createElement('style');
        style.innerHTML = stylesheet.join('\n');
        document.getElementsByTagName('head')[0].appendChild(style);
    }

    function DebugTiles() {
        let all_tile_types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 432, 433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443, 444, 445, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 512, 513, 514, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 535, 544, 545, 546, 547, 548, 549, 550, 551, 560, 561, 562, 563, 564, 565, 566, 567, 576, 577, 578, 579, 580, 581, 582, 583, 592, 593, 594, 595, 596, 597, 598, 599, 608, 609, 610, 611, 612, 613, 614, 615, 624, 625, 626, 627, 628, 629, 630, 631, 640, 641, 642, 643, 644, 645, 646, 647, 656, 657, 658, 659, 660, 661, 662, 663, 672, 673, 674, 675, 676, 677, 678, 679, 688, 689, 690, 691, 692, 693, 694, 695, 704, 705, 706, 707, 708, 709, 710, 711, 720, 721, 722, 723, 724, 725, 726, 727, 736, 737, 738, 739, 740, 741, 742, 743, 752, 753, 754, 755, 756, 757, 758, 759, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 784, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 816, 817, 818, 819, 820, 821, 822, 823, 824, 825, 826, 827, 828, 829, 538, 539, 543, 716, 747];
        all_tile_types.sort(function(a, b) {
            return a - b;
        });
        
        let tiles = $('#minimap').html('');
        
        let stack = [].concat(all_tile_types);
        for (let y = 0; y < 22; ++y) {
            let row = $('<div/>');
            for (let x = 0; x < 30; ++x) {
                row.append($('<tile/>').addClass('tile-' + stack.shift()));
            }
            tiles.append(row);
        }
    }
});
