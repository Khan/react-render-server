// flow-typed signature: 081eb78fc3d05183ad7b27e9b7d935b1
// flow-typed version: c6154227d1/chai_v4.x.x/flow_>=v0.104.x

declare module "chai" {
  declare type ExpectChain<T> = {
    and: ExpectChain<T>,
    at: ExpectChain<T>,
    be: ExpectChain<T>,
    been: ExpectChain<T>,
    have: ExpectChain<T>,
    has: ExpectChain<T>,
    is: ExpectChain<T>,
    of: ExpectChain<T>,
    same: ExpectChain<T>,
    that: ExpectChain<T>,
    to: ExpectChain<T>,
    which: ExpectChain<T>,
    with: ExpectChain<T>,
    not: ExpectChain<T>,
    deep: ExpectChain<T>,
    any: ExpectChain<T>,
    all: ExpectChain<T>,
    own: ExpectChain<T>,
    a: ExpectChain<T> & ((type: string, message?: string) => ExpectChain<T>),
    an: ExpectChain<T> & ((type: string, message?: string) => ExpectChain<T>),
    include: ExpectChain<T> & ((value: mixed, message?: string) => ExpectChain<T>),
    includes: ExpectChain<T> & ((value: mixed, message?: string) => ExpectChain<T>),
    contain: ExpectChain<T> & ((value: mixed, message?: string) => ExpectChain<T>),
    contains: ExpectChain<T> & ((value: mixed, message?: string) => ExpectChain<T>),
    eq: (value: T, message?: string) => ExpectChain<T>,
    eql: (value: T, message?: string) => ExpectChain<T>,
    equal: (value: T, message?: string) => ExpectChain<T>,
    equals: (value: T, message?: string) => ExpectChain<T>,
    above: (value: T & number, message?: string) => ExpectChain<T>,
    gt: (value: T & number, message?: string) => ExpectChain<T>,
    greaterThan: (value: T & number, message?: string) => ExpectChain<T>,
    least: (value: T & number, message?: string) => ExpectChain<T>,
    below: (value: T & number, message?: string) => ExpectChain<T>,
    lessThan: (value: T & number, message?: string) => ExpectChain<T>,
    lt: (value: T & number, message?: string) => ExpectChain<T>,
    most: (value: T & number, message?: string) => ExpectChain<T>,
    within: (start: T & number, finish: T & number, message?: string) => ExpectChain<T>,
    instanceof: (constructor: mixed, message?: string) => ExpectChain<T>,
    instanceOf: (constructor: mixed, message?: string) => ExpectChain<T>,
    nested: ExpectChain<T>,
    property: <P>(
      name: string,
      value?: P,
      message?: string
    ) => ExpectChain<P> & ((name: string) => ExpectChain<mixed>),
    length: ExpectChain<number> & ((value: number, message?: string) => ExpectChain<T>),
    lengthOf: (value: number, message?: string) => ExpectChain<T>,
    match: (regex: RegExp, message?: string) => ExpectChain<T>,
    matches: (regex: RegExp, message?: string) => ExpectChain<T>,
    string: (string: string, message?: string) => ExpectChain<T>,
    key: (key: string) => ExpectChain<T>,
    keys: (
      key: string | Array<string>,
      ...keys: Array<string>
    ) => ExpectChain<T>,
    throw: <E>(
      err?: Class<E> | Error | RegExp | string,
      errMsgMatcher?: RegExp | string,
      msg?: string
    ) => ExpectChain<T>,
    respondTo: (method: string, message?: string) => ExpectChain<T>,
    itself: ExpectChain<T>,
    satisfy: (method: (value: T) => boolean, message?: string) => ExpectChain<T>,
    closeTo: (expected: T & number, delta: number, message?: string) => ExpectChain<T>,
    members: (set: mixed, message?: string) => ExpectChain<T>,
    oneOf: (list: Array<T>, message?: string) => ExpectChain<T>,
    change: (obj: mixed, key: string, message?: string) => ExpectChain<T>,
    increase: (obj: mixed, key: string, message?: string) => ExpectChain<T>,
    decrease: (obj: mixed, key: string, message?: string) => ExpectChain<T>,
    by: (delta: number, message?: string) => ExpectChain<T>,
    ordered: ExpectChain<T>,
    // dirty-chai
    ok: () => ExpectChain<T>,
    true: () => ExpectChain<T>,
    false: () => ExpectChain<T>,
    null: () => ExpectChain<T>,
    undefined: () => ExpectChain<T>,
    exist: () => ExpectChain<T>,
    empty: () => ExpectChain<T>,
    extensible: () => ExpectChain<T>,
    sealed: () => ExpectChain<T>,
    frozen: () => ExpectChain<T>,
    NaN: () => ExpectChain<T>,
    // chai-immutable
    size: (n: number) => ExpectChain<T>,
    // sinon-chai
    called: () => ExpectChain<T>,
    callCount: (n: number) => ExpectChain<T>,
    calledOnce: () => ExpectChain<T>,
    calledTwice: () => ExpectChain<T>,
    calledThrice: () => ExpectChain<T>,
    calledBefore: (spy: mixed) => ExpectChain<T>,
    calledAfter: (spy: mixed) => ExpectChain<T>,
    calledImmediatelyBefore: (spy: mixed) => ExpectChain<T>,
    calledImmediatelyAfter: (spy: mixed) => ExpectChain<T>,
    calledWith: (...args: Array<mixed>) => ExpectChain<T>,
    calledOnceWith: (...args: Array<mixed>) => ExpectChain<T>,
    calledWithMatch: (...args: Array<mixed>) => ExpectChain<T>,
    calledWithExactly: (...args: Array<mixed>) => ExpectChain<T>,
    calledOnceWithExactly: (...args: Array<mixed>) => ExpectChain<T>,
    returned: (returnVal: mixed) => ExpectChain<T>,
    alwaysReturned: (returnVal: mixed) => ExpectChain<T>,
    // chai-as-promised
    eventually: ExpectChain<T>,
    resolvedWith: (value: mixed) => Promise<mixed> & ExpectChain<T>,
    resolved: () => Promise<mixed> & ExpectChain<T>,
    rejectedWith: (
      value: mixed,
      errMsgMatcher?: RegExp | string,
      msg?: string
    ) => Promise<mixed> & ExpectChain<T>,
    rejected: () => Promise<mixed> & ExpectChain<T>,
    notify: (callback: () => mixed) => ExpectChain<T>,
    fulfilled: () => Promise<mixed> & ExpectChain<T>,
    // chai-subset
    containSubset: (obj: {...} | Array< {...} >) => ExpectChain<T>,
    // chai-redux-mock-store
    dispatchedActions: (
      actions: Array<{...} | ((action: {...}) => any)>
    ) => ExpectChain<T>,
    dispatchedTypes: (actions: Array<string>) => ExpectChain<T>,
    // chai-enzyme
    attr: (key: string, val?: any) => ExpectChain<T>,
    data: (key: string, val?: any) => ExpectChain<T>,
    prop: (key: string, val?: any) => ExpectChain<T>,
    state: (key: string, val?: any) => ExpectChain<T>,
    value: (val: string) => ExpectChain<T>,
    className: (val: string) => ExpectChain<T>,
    text: (val: string) => ExpectChain<T>,
    // chai-karma-snapshot
    matchSnapshot: (lang?: any, update?: boolean, msg?: any) => ExpectChain<T>,
    ...
  };


  declare var expect: {
    <T>(actual: T, message?: string): ExpectChain<T>,
    fail: ((message?: string) => void) & ((actual: any, expected: any, message?: string, operator?: string) => void),
    ...
  };

  declare function use(plugin: (chai: Object, utils: Object) => void): void;

  declare class assert {
    static (expression: mixed, message?: string): void;
    static fail(
      actual: mixed,
      expected: mixed,
      message?: string,
      operator?: string
    ): void;

    static isOk(object: mixed, message?: string): void;
    static isNotOk(object: mixed, message?: string): void;

    static empty(object: mixed, message?: string): void;
    static isEmpty(object: mixed, message?: string): void;
    static notEmpty(object: mixed, message?: string): void;
    static isNotEmpty(object: mixed, message?: string): void;

    static equal(actual: mixed, expected: mixed, message?: string): void;
    static notEqual(actual: mixed, expected: mixed, message?: string): void;

    static strictEqual(act: mixed, exp: mixed, msg?: string): void;
    static notStrictEqual(act: mixed, exp: mixed, msg?: string): void;

    static deepEqual(act: mixed, exp: mixed, msg?: string): void;
    static notDeepEqual(act: mixed, exp: mixed, msg?: string): void;

    static ok(val: mixed, msg?: string): void;
    static isTrue(val: mixed, msg?: string): void;
    static isNotTrue(val: mixed, msg?: string): void;
    static isFalse(val: mixed, msg?: string): void;
    static isNotFalse(val: mixed, msg?: string): void;

    static isNull(val: mixed, msg?: string): void;
    static isNotNull(val: mixed, msg?: string): void;

    static isUndefined(val: mixed, msg?: string): void;
    static isDefined(val: mixed, msg?: string): void;

    static isNaN(val: mixed, msg?: string): void;
    static isNotNaN(val: mixed, msg?: string): void;

    static isAbove(val: number, abv: number, msg?: string): void;
    static isBelow(val: number, blw: number, msg?: string): void;

    static isAtMost(val: number, atmst: number, msg?: string): void;
    static isAtLeast(val: number, atlst: number, msg?: string): void;

    static isFunction(val: mixed, msg?: string): void;
    static isNotFunction(val: mixed, msg?: string): void;

    static isObject(val: mixed, msg?: string): void;
    static isNotObject(val: mixed, msg?: string): void;

    static isArray(val: mixed, msg?: string): void;
    static isNotArray(val: mixed, msg?: string): void;

    static isString(val: mixed, msg?: string): void;
    static isNotString(val: mixed, msg?: string): void;

    static isNumber(val: mixed, msg?: string): void;
    static isNotNumber(val: mixed, msg?: string): void;

    static isBoolean(val: mixed, msg?: string): void;
    static isNotBoolean(val: mixed, msg?: string): void;

    static typeOf(val: mixed, type: string, msg?: string): void;
    static notTypeOf(val: mixed, type: string, msg?: string): void;

    static instanceOf(val: mixed, constructor: Class< * >, msg?: string): void;
    static notInstanceOf(val: mixed, constructor: Class< * >, msg?: string): void;

    static include(exp: string, inc: mixed, msg?: string): void;
    static include<T>(exp: Array<T>, inc: T, msg?: string): void;

    static notInclude(exp: string, inc: mixed, msg?: string): void;
    static notInclude<T>(exp: Array<T>, inc: T, msg?: string): void;

    static match(exp: mixed, re: RegExp, msg?: string): void;
    static notMatch(exp: mixed, re: RegExp, msg?: string): void;

    static property(obj: Object, prop: string, msg?: string): void;
    static notProperty(obj: Object, prop: string, msg?: string): void;
    static deepProperty(obj: Object, prop: string, msg?: string): void;
    static notDeepProperty(obj: Object, prop: string, msg?: string): void;

    static propertyVal(
      obj: Object,
      prop: string,
      val: mixed,
      msg?: string
    ): void;
    static propertyNotVal(
      obj: Object,
      prop: string,
      val: mixed,
      msg?: string
    ): void;

    static deepPropertyVal(
      obj: Object,
      prop: string,
      val: mixed,
      msg?: string
    ): void;
    static deepPropertyNotVal(
      obj: Object,
      prop: string,
      val: mixed,
      msg?: string
    ): void;

    static lengthOf(exp: mixed, len: number, msg?: string): void;

    static throws<E>(
      func: () => any,
      err?: Class<E> | Error | RegExp | string,
      errorMsgMatcher?: string | RegExp,
      msg?: string
    ): void;
    static doesNotThrow<E>(
      func: () => any,
      err?: Class<E> | Error | RegExp | string,
      errorMsgMatcher?: string | RegExp,
      msg?: string
    ): void;

    static closeTo(
      actual: number,
      expected: number,
      delta: number,
      msg?: string
    ): void;
    static approximately(
      actual: number,
      expected: number,
      delta: number,
      msg?: string
    ): void;

    // chai-immutable
    static sizeOf(val: mixed, length: number): void;

    // chai-as-promised
    static eventually: PromisedAssert;
    static isFulfilled(promise: Promise<any>, message?: string): Promise<void>;
    static becomes(promise: Promise<any>, expected: any, message?: string): Promise<void>;
    static doesNotBecome(promise: Promise<T>, expected: any, message?: string): Promise<void>;
    static isRejected<T>(promise: Promise<T>, message?: string): Promise<void>;
    static isRejected<T>(promise: Promise<T>, expected: any, message?: string): Promise<void>;
    static isRejected<T>(promise: Promise<T>, match: RegExp, message?: string): Promise<void>;
    static notify(fn: Function): Promise<void>;
  }

  declare interface PromisedAssert {
      fail(actual?: any, expected?: any, msg?: string, operator?: string): Promise<void>;

      isOk(val: any, msg?: string): Promise<void>;
      ok(val: any, msg?: string): Promise<void>;
      isNotOk(val: any, msg?: string): Promise<void>;
      notOk(val: any, msg?: string): Promise<void>;

      equal(act: any, exp: any, msg?: string): Promise<void>;
      notEqual(act: any, exp: any, msg?: string): Promise<void>;

      strictEqual(act: any, exp: any, msg?: string): Promise<void>;
      notStrictEqual(act: any, exp: any, msg?: string): Promise<void>;

      deepEqual(act: any, exp: any, msg?: string): Promise<void>;
      notDeepEqual(act: any, exp: any, msg?: string): Promise<void>;

      isAbove(val: number, above: number, msg?: string): Promise<void>;
      isAtLeast(val: number, atLeast: number, msg?: string): Promise<void>;
      isAtBelow(val: number, below: number, msg?: string): Promise<void>;
      isAtMost(val: number, atMost: number, msg?: string): Promise<void>;

      isTrue(val: any, msg?: string): Promise<void>;
      isFalse(val: any, msg?: string): Promise<void>;

      isNotTrue(val: any, msg?: string): Promise<void>;
      isNotFalse(val: any, msg?: string): Promise<void>;

      isNull(val: any, msg?: string): Promise<void>;
      isNotNull(val: any, msg?: string): Promise<void>;

      isNaN(val: any, msg?: string): Promise<void>;
      isNotNaN(val: any, msg?: string): Promise<void>;

      exists(val: any, msg?: string): Promise<void>;
      notExists(val: any, msg?: string): Promise<void>;

      isUndefined(val: any, msg?: string): Promise<void>;
      isDefined(val: any, msg?: string): Promise<void>;

      isFunction(val: any, msg?: string): Promise<void>;
      isNotFunction(val: any, msg?: string): Promise<void>;

      isObject(val: any, msg?: string): Promise<void>;
      isNotObject(val: any, msg?: string): Promise<void>;

      isArray(val: any, msg?: string): Promise<void>;
      isNotArray(val: any, msg?: string): Promise<void>;

      isString(val: any, msg?: string): Promise<void>;
      isNotString(val: any, msg?: string): Promise<void>;

      isNumber(val: any, msg?: string): Promise<void>;
      isNotNumber(val: any, msg?: string): Promise<void>;

      isBoolean(val: any, msg?: string): Promise<void>;
      isNotBoolean(val: any, msg?: string): Promise<void>;

      typeOf(val: any, type: string, msg?: string): Promise<void>;
      notTypeOf(val: any, type: string, msg?: string): Promise<void>;

      instanceOf(val: any, type: Function, msg?: string): Promise<void>;
      notInstanceOf(val: any, type: Function, msg?: string): Promise<void>;

      include(exp: string, inc: any, msg?: string): Promise<void>;
      include(exp: any[], inc: any, msg?: string): Promise<void>;

      notInclude(exp: string, inc: any, msg?: string): Promise<void>;
      notInclude(exp: any[], inc: any, msg?: string): Promise<void>;

      match(exp: any, re: RegExp, msg?: string): Promise<void>;
      notMatch(exp: any, re: RegExp, msg?: string): Promise<void>;

      property(obj: Object, prop: string, msg?: string): Promise<void>;
      notProperty(obj: Object, prop: string, msg?: string): Promise<void>;
      deepProperty(obj: Object, prop: string, msg?: string): Promise<void>;
      notDeepProperty(obj: Object, prop: string, msg?: string): Promise<void>;

      propertyVal(obj: Object, prop: string, val: any, msg?: string): Promise<void>;
      propertyNotVal(obj: Object, prop: string, val: any, msg?: string): Promise<void>;

      deepPropertyVal(obj: Object, prop: string, val: any, msg?: string): Promise<void>;
      deepPropertyNotVal(obj: Object, prop: string, val: any, msg?: string): Promise<void>;

      lengthOf(exp: any, len: number, msg?: string): Promise<void>;
      //alias frenzy
      throw(fn: Function, msg?: string): Promise<void>;
      throw(fn: Function, regExp: RegExp): Promise<void>;
      throw(fn: Function, errType: Function, msg?: string): Promise<void>;
      throw(fn: Function, errType: Function, regExp: RegExp): Promise<void>;

      throws(fn: Function, msg?: string): Promise<void>;
      throws(fn: Function, regExp: RegExp): Promise<void>;
      throws(fn: Function, errType: Function, msg?: string): Promise<void>;
      throws(fn: Function, errType: Function, regExp: RegExp): Promise<void>;

      Throw(fn: Function, msg?: string): Promise<void>;
      Throw(fn: Function, regExp: RegExp): Promise<void>;
      Throw(fn: Function, errType: Function, msg?: string): Promise<void>;
      Throw(fn: Function, errType: Function, regExp: RegExp): Promise<void>;

      doesNotThrow(fn: Function, msg?: string): Promise<void>;
      doesNotThrow(fn: Function, regExp: RegExp): Promise<void>;
      doesNotThrow(fn: Function, errType: Function, msg?: string): Promise<void>;
      doesNotThrow(fn: Function, errType: Function, regExp: RegExp): Promise<void>;

      operator(val: any, operator: string, val2: any, msg?: string): Promise<void>;
      closeTo(act: number, exp: number, delta: number, msg?: string): Promise<void>;
      approximately(act: number, exp: number, delta: number, msg?: string): Promise<void>;

      sameMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      sameDeepMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      sameOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      notSameOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      sameDeepOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      notSameDeepOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      includeOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      notIncludeOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      includeDeepOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      notIncludeDeepOrderedMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      includeMembers(set1: any[], set2: any[], msg?: string): Promise<void>;
      includeDeepMembers(set1: any[], set2: any[], msg?: string): Promise<void>;

      oneOf(val: any, list: any[], msg?: string): Promise<void>;

      changes(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;
      doesNotChange(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;
      increases(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;
      doesNotIncrease(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;
      decreases(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;
      doesNotDecrease(modifier: Function, obj: Object, property: string, msg?: string): Promise<void>;

      ifError(val: any, msg?: string): Promise<void>;

      isExtensible(obj: Object, msg?: string): Promise<void>;
      isNotExtensible(obj: Object, msg?: string): Promise<void>;

      isSealed(obj: Object, msg?: string): Promise<void>;
      sealed(obj: Object, msg?: string): Promise<void>;
      isNotSealed(obj: Object, msg?: string): Promise<void>;
      notSealed(obj: Object, msg?: string): Promise<void>;

      isFrozen(obj: Object, msg?: string): Promise<void>;
      frozen(obj: Object, msg?: string): Promise<void>;
      isNotFrozen(obj: Object, msg?: string): Promise<void>;
      notFrozen(obj: Object, msg?: string): Promise<void>;

      isEmpty(val: any, msg?: string): Promise<void>;
      isNotEmpty(val: any, msg?: string): Promise<void>;
  }

  declare var config: {
    includeStack: boolean,
    showDiff: boolean,
    truncateThreshold: number,
    ...
  };
}
