const Cast = require('../util/cast');

class Scratch3ProcedureBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            procedures_definition: this.definition,
            procedures_call: this.call,
            procedures_return: this.return,
            procedures_scriptvar_def: this.definition, // Also no-op
            procedures_setscriptvarto: this.setArgumentTo,
            procedures_changescriptvarby: this.changeArgumentBy,
            argument_reporter_string_number: this.argumentReporterStringNumber,
            argument_reporter_boolean: this.argumentReporterBoolean,
        };
    }

    definition () {
        // No-op: execute the blocks.
    }

    call (args, util) {
        const stackFrame = util.stackFrame;
        const isReporter = !!args.mutation.return;

        if (stackFrame.executed) {
            if (isReporter) {
                const returnValue = stackFrame.returnValue;
                // This stackframe will be reused for other reporters in this block, so clean it up for them.
                // Can't use reset() because that will reset too much.
                const threadStackFrame = util.thread.peekStackFrame();
                threadStackFrame.params = null;
                threadStackFrame.executionContext = null;
                return returnValue;
            }
            return;
        }

        const procedureCode = args.mutation.proccode;
        const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(procedureCode);

        // If null, procedure could not be found, which can happen if custom
        // block is dragged between sprites without the definition.
        // Match Scratch 2.0 behavior and noop.
        if (paramNamesIdsAndDefaults === null) {
            return;
        }

        const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;

        // Initialize params for the current stackFrame to {}, even if the procedure does
        // not take any arguments. This is so that `getParam` down the line does not look
        // at earlier stack frames for the values of a given parameter (#1729)
        util.initParams();
        for (let i = 0; i < paramIds.length; i++) {
            if (args.hasOwnProperty(paramIds[i])) {
                util.pushParam(paramNames[i], args[paramIds[i]]);
            } else {
                util.pushParam(paramNames[i], paramDefaults[i]);
            }
        }
        stackFrame.executed = true;

        if (isReporter) {
            util.thread.peekStackFrame().waitingReporter = true;
            // Default return value
            stackFrame.returnValue = '';
        }

        util.startProcedure(procedureCode);
    }
    
    return (args, util) {
        util.stopThisScript();
        // If used outside of a custom block, there may be no stackframe.
        if (util.thread.peekStackFrame()) {
            util.stackFrame.returnValue = args.VALUE;
        }
    }

    argumentReporterStringNumber (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }

    argumentReporterBoolean (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }
    
    setArgumentTo (args, util) {
        util.setParam(args.NAME, args.VALUE);
    }
    
    changeArgumentBy (args, util) {
        util.setParam(args.NAME, Cast.toNumber(util.getParam(args.NAME)) + Cast.toNumber(args.VALUE));
    }
}

module.exports = Scratch3ProcedureBlocks;
