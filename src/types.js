// @flow
import type {Levels} from "winston";

export type Arguments = {|
    port: number,
    dev: boolean,
    log_level: $Keys<Levels>,
|};
