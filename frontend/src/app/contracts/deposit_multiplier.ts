import {
  Cell,
  Slice,
  Address,
  Builder,
  beginCell,
  ComputeError,
  TupleItem,
  TupleReader,
  Dictionary,
  contractAddress,
  ContractProvider,
  Sender,
  Contract,
  ContractABI,
  ABIType,
  ABIGetter,
  ABIReceiver,
  TupleBuilder,
  DictionaryValue,
} from "@ton/core";

export type StateInit = {
  $$type: "StateInit";
  code: Cell;
  data: Cell;
};

export function storeStateInit(src: StateInit) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeRef(src.code);
    b_0.storeRef(src.data);
  };
}

export function loadStateInit(slice: Slice) {
  let sc_0 = slice;
  let _code = sc_0.loadRef();
  let _data = sc_0.loadRef();
  return { $$type: "StateInit" as const, code: _code, data: _data };
}

function loadTupleStateInit(source: TupleReader) {
  let _code = source.readCell();
  let _data = source.readCell();
  return { $$type: "StateInit" as const, code: _code, data: _data };
}

function storeTupleStateInit(source: StateInit) {
  let builder = new TupleBuilder();
  builder.writeCell(source.code);
  builder.writeCell(source.data);
  return builder.build();
}

function dictValueParserStateInit(): DictionaryValue<StateInit> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeStateInit(src)).endCell());
    },
    parse: (src) => {
      return loadStateInit(src.loadRef().beginParse());
    },
  };
}

export type Context = {
  $$type: "Context";
  bounced: boolean;
  sender: Address;
  value: bigint;
  raw: Cell;
};

export function storeContext(src: Context) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeBit(src.bounced);
    b_0.storeAddress(src.sender);
    b_0.storeInt(src.value, 257);
    b_0.storeRef(src.raw);
  };
}

export function loadContext(slice: Slice) {
  let sc_0 = slice;
  let _bounced = sc_0.loadBit();
  let _sender = sc_0.loadAddress();
  let _value = sc_0.loadIntBig(257);
  let _raw = sc_0.loadRef();
  return {
    $$type: "Context" as const,
    bounced: _bounced,
    sender: _sender,
    value: _value,
    raw: _raw,
  };
}

function loadTupleContext(source: TupleReader) {
  let _bounced = source.readBoolean();
  let _sender = source.readAddress();
  let _value = source.readBigNumber();
  let _raw = source.readCell();
  return {
    $$type: "Context" as const,
    bounced: _bounced,
    sender: _sender,
    value: _value,
    raw: _raw,
  };
}

function storeTupleContext(source: Context) {
  let builder = new TupleBuilder();
  builder.writeBoolean(source.bounced);
  builder.writeAddress(source.sender);
  builder.writeNumber(source.value);
  builder.writeSlice(source.raw);
  return builder.build();
}

function dictValueParserContext(): DictionaryValue<Context> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeContext(src)).endCell());
    },
    parse: (src) => {
      return loadContext(src.loadRef().beginParse());
    },
  };
}

export type SendParameters = {
  $$type: "SendParameters";
  bounce: boolean;
  to: Address;
  value: bigint;
  mode: bigint;
  body: Cell | null;
  code: Cell | null;
  data: Cell | null;
};

export function storeSendParameters(src: SendParameters) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeBit(src.bounce);
    b_0.storeAddress(src.to);
    b_0.storeInt(src.value, 257);
    b_0.storeInt(src.mode, 257);
    if (src.body !== null && src.body !== undefined) {
      b_0.storeBit(true).storeRef(src.body);
    } else {
      b_0.storeBit(false);
    }
    if (src.code !== null && src.code !== undefined) {
      b_0.storeBit(true).storeRef(src.code);
    } else {
      b_0.storeBit(false);
    }
    if (src.data !== null && src.data !== undefined) {
      b_0.storeBit(true).storeRef(src.data);
    } else {
      b_0.storeBit(false);
    }
  };
}

export function loadSendParameters(slice: Slice) {
  let sc_0 = slice;
  let _bounce = sc_0.loadBit();
  let _to = sc_0.loadAddress();
  let _value = sc_0.loadIntBig(257);
  let _mode = sc_0.loadIntBig(257);
  let _body = sc_0.loadBit() ? sc_0.loadRef() : null;
  let _code = sc_0.loadBit() ? sc_0.loadRef() : null;
  let _data = sc_0.loadBit() ? sc_0.loadRef() : null;
  return {
    $$type: "SendParameters" as const,
    bounce: _bounce,
    to: _to,
    value: _value,
    mode: _mode,
    body: _body,
    code: _code,
    data: _data,
  };
}

function loadTupleSendParameters(source: TupleReader) {
  let _bounce = source.readBoolean();
  let _to = source.readAddress();
  let _value = source.readBigNumber();
  let _mode = source.readBigNumber();
  let _body = source.readCellOpt();
  let _code = source.readCellOpt();
  let _data = source.readCellOpt();
  return {
    $$type: "SendParameters" as const,
    bounce: _bounce,
    to: _to,
    value: _value,
    mode: _mode,
    body: _body,
    code: _code,
    data: _data,
  };
}

function storeTupleSendParameters(source: SendParameters) {
  let builder = new TupleBuilder();
  builder.writeBoolean(source.bounce);
  builder.writeAddress(source.to);
  builder.writeNumber(source.value);
  builder.writeNumber(source.mode);
  builder.writeCell(source.body);
  builder.writeCell(source.code);
  builder.writeCell(source.data);
  return builder.build();
}

function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeSendParameters(src)).endCell());
    },
    parse: (src) => {
      return loadSendParameters(src.loadRef().beginParse());
    },
  };
}

export type Deploy = {
  $$type: "Deploy";
  queryId: bigint;
};

export function storeDeploy(src: Deploy) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(2490013878, 32);
    b_0.storeUint(src.queryId, 64);
  };
}

export function loadDeploy(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 2490013878) {
    throw Error("Invalid prefix");
  }
  let _queryId = sc_0.loadUintBig(64);
  return { $$type: "Deploy" as const, queryId: _queryId };
}

function loadTupleDeploy(source: TupleReader) {
  let _queryId = source.readBigNumber();
  return { $$type: "Deploy" as const, queryId: _queryId };
}

function storeTupleDeploy(source: Deploy) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.queryId);
  return builder.build();
}

function dictValueParserDeploy(): DictionaryValue<Deploy> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeDeploy(src)).endCell());
    },
    parse: (src) => {
      return loadDeploy(src.loadRef().beginParse());
    },
  };
}

export type DeployOk = {
  $$type: "DeployOk";
  queryId: bigint;
};

export function storeDeployOk(src: DeployOk) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(2952335191, 32);
    b_0.storeUint(src.queryId, 64);
  };
}

export function loadDeployOk(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 2952335191) {
    throw Error("Invalid prefix");
  }
  let _queryId = sc_0.loadUintBig(64);
  return { $$type: "DeployOk" as const, queryId: _queryId };
}

function loadTupleDeployOk(source: TupleReader) {
  let _queryId = source.readBigNumber();
  return { $$type: "DeployOk" as const, queryId: _queryId };
}

function storeTupleDeployOk(source: DeployOk) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.queryId);
  return builder.build();
}

function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeDeployOk(src)).endCell());
    },
    parse: (src) => {
      return loadDeployOk(src.loadRef().beginParse());
    },
  };
}

export type FactoryDeploy = {
  $$type: "FactoryDeploy";
  queryId: bigint;
  cashback: Address;
};

export function storeFactoryDeploy(src: FactoryDeploy) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(1829761339, 32);
    b_0.storeUint(src.queryId, 64);
    b_0.storeAddress(src.cashback);
  };
}

export function loadFactoryDeploy(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 1829761339) {
    throw Error("Invalid prefix");
  }
  let _queryId = sc_0.loadUintBig(64);
  let _cashback = sc_0.loadAddress();
  return {
    $$type: "FactoryDeploy" as const,
    queryId: _queryId,
    cashback: _cashback,
  };
}

function loadTupleFactoryDeploy(source: TupleReader) {
  let _queryId = source.readBigNumber();
  let _cashback = source.readAddress();
  return {
    $$type: "FactoryDeploy" as const,
    queryId: _queryId,
    cashback: _cashback,
  };
}

function storeTupleFactoryDeploy(source: FactoryDeploy) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.queryId);
  builder.writeAddress(source.cashback);
  return builder.build();
}

function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
    },
    parse: (src) => {
      return loadFactoryDeploy(src.loadRef().beginParse());
    },
  };
}

export type ChangeOwner = {
  $$type: "ChangeOwner";
  queryId: bigint;
  newOwner: Address;
};

export function storeChangeOwner(src: ChangeOwner) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(2174598809, 32);
    b_0.storeUint(src.queryId, 64);
    b_0.storeAddress(src.newOwner);
  };
}

export function loadChangeOwner(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 2174598809) {
    throw Error("Invalid prefix");
  }
  let _queryId = sc_0.loadUintBig(64);
  let _newOwner = sc_0.loadAddress();
  return {
    $$type: "ChangeOwner" as const,
    queryId: _queryId,
    newOwner: _newOwner,
  };
}

function loadTupleChangeOwner(source: TupleReader) {
  let _queryId = source.readBigNumber();
  let _newOwner = source.readAddress();
  return {
    $$type: "ChangeOwner" as const,
    queryId: _queryId,
    newOwner: _newOwner,
  };
}

function storeTupleChangeOwner(source: ChangeOwner) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.queryId);
  builder.writeAddress(source.newOwner);
  return builder.build();
}

function dictValueParserChangeOwner(): DictionaryValue<ChangeOwner> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeChangeOwner(src)).endCell());
    },
    parse: (src) => {
      return loadChangeOwner(src.loadRef().beginParse());
    },
  };
}

export type ChangeOwnerOk = {
  $$type: "ChangeOwnerOk";
  queryId: bigint;
  newOwner: Address;
};

export function storeChangeOwnerOk(src: ChangeOwnerOk) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(846932810, 32);
    b_0.storeUint(src.queryId, 64);
    b_0.storeAddress(src.newOwner);
  };
}

export function loadChangeOwnerOk(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 846932810) {
    throw Error("Invalid prefix");
  }
  let _queryId = sc_0.loadUintBig(64);
  let _newOwner = sc_0.loadAddress();
  return {
    $$type: "ChangeOwnerOk" as const,
    queryId: _queryId,
    newOwner: _newOwner,
  };
}

function loadTupleChangeOwnerOk(source: TupleReader) {
  let _queryId = source.readBigNumber();
  let _newOwner = source.readAddress();
  return {
    $$type: "ChangeOwnerOk" as const,
    queryId: _queryId,
    newOwner: _newOwner,
  };
}

function storeTupleChangeOwnerOk(source: ChangeOwnerOk) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.queryId);
  builder.writeAddress(source.newOwner);
  return builder.build();
}

function dictValueParserChangeOwnerOk(): DictionaryValue<ChangeOwnerOk> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeChangeOwnerOk(src)).endCell());
    },
    parse: (src) => {
      return loadChangeOwnerOk(src.loadRef().beginParse());
    },
  };
}

export type UpdateMultiplierFactor = {
  $$type: "UpdateMultiplierFactor";
  newFactor: bigint;
};

export function storeUpdateMultiplierFactor(src: UpdateMultiplierFactor) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(1636919924, 32);
    b_0.storeUint(src.newFactor, 32);
  };
}

export function loadUpdateMultiplierFactor(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 1636919924) {
    throw Error("Invalid prefix");
  }
  let _newFactor = sc_0.loadUintBig(32);
  return { $$type: "UpdateMultiplierFactor" as const, newFactor: _newFactor };
}

function loadTupleUpdateMultiplierFactor(source: TupleReader) {
  let _newFactor = source.readBigNumber();
  return { $$type: "UpdateMultiplierFactor" as const, newFactor: _newFactor };
}

function storeTupleUpdateMultiplierFactor(source: UpdateMultiplierFactor) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.newFactor);
  return builder.build();
}

function dictValueParserUpdateMultiplierFactor(): DictionaryValue<UpdateMultiplierFactor> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(
        beginCell().store(storeUpdateMultiplierFactor(src)).endCell()
      );
    },
    parse: (src) => {
      return loadUpdateMultiplierFactor(src.loadRef().beginParse());
    },
  };
}

export type AdminWithdraw = {
  $$type: "AdminWithdraw";
  amount: bigint;
};

export function storeAdminWithdraw(src: AdminWithdraw) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeUint(2288463416, 32);
    b_0.storeCoins(src.amount);
  };
}

export function loadAdminWithdraw(slice: Slice) {
  let sc_0 = slice;
  if (sc_0.loadUint(32) !== 2288463416) {
    throw Error("Invalid prefix");
  }
  let _amount = sc_0.loadCoins();
  return { $$type: "AdminWithdraw" as const, amount: _amount };
}

function loadTupleAdminWithdraw(source: TupleReader) {
  let _amount = source.readBigNumber();
  return { $$type: "AdminWithdraw" as const, amount: _amount };
}

function storeTupleAdminWithdraw(source: AdminWithdraw) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.amount);
  return builder.build();
}

function dictValueParserAdminWithdraw(): DictionaryValue<AdminWithdraw> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeAdminWithdraw(src)).endCell());
    },
    parse: (src) => {
      return loadAdminWithdraw(src.loadRef().beginParse());
    },
  };
}

export type DepositInfo = {
  $$type: "DepositInfo";
  id: bigint;
  amount: bigint;
  multiplier: bigint;
  startTime: bigint;
  active: boolean;
};

export function storeDepositInfo(src: DepositInfo) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeInt(src.id, 257);
    b_0.storeInt(src.amount, 257);
    b_0.storeInt(src.multiplier, 257);
    let b_1 = new Builder();
    b_1.storeInt(src.startTime, 257);
    b_1.storeBit(src.active);
    b_0.storeRef(b_1.endCell());
  };
}

export function loadDepositInfo(slice: Slice) {
  let sc_0 = slice;
  let _id = sc_0.loadIntBig(257);
  let _amount = sc_0.loadIntBig(257);
  let _multiplier = sc_0.loadIntBig(257);
  let sc_1 = sc_0.loadRef().beginParse();
  let _startTime = sc_1.loadIntBig(257);
  let _active = sc_1.loadBit();
  return {
    $$type: "DepositInfo" as const,
    id: _id,
    amount: _amount,
    multiplier: _multiplier,
    startTime: _startTime,
    active: _active,
  };
}

function loadTupleDepositInfo(source: TupleReader) {
  let _id = source.readBigNumber();
  let _amount = source.readBigNumber();
  let _multiplier = source.readBigNumber();
  let _startTime = source.readBigNumber();
  let _active = source.readBoolean();
  return {
    $$type: "DepositInfo" as const,
    id: _id,
    amount: _amount,
    multiplier: _multiplier,
    startTime: _startTime,
    active: _active,
  };
}

function storeTupleDepositInfo(source: DepositInfo) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.id);
  builder.writeNumber(source.amount);
  builder.writeNumber(source.multiplier);
  builder.writeNumber(source.startTime);
  builder.writeBoolean(source.active);
  return builder.build();
}

function dictValueParserDepositInfo(): DictionaryValue<DepositInfo> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeDepositInfo(src)).endCell());
    },
    parse: (src) => {
      return loadDepositInfo(src.loadRef().beginParse());
    },
  };
}

export type UserDeposits = {
  $$type: "UserDeposits";
  totalDeposits: bigint;
  deposits: Dictionary<bigint, DepositInfo>;
  lastDepositId: bigint;
};

export function storeUserDeposits(src: UserDeposits) {
  return (builder: Builder) => {
    let b_0 = builder;
    b_0.storeInt(src.totalDeposits, 257);
    b_0.storeDict(
      src.deposits,
      Dictionary.Keys.BigInt(257),
      dictValueParserDepositInfo()
    );
    b_0.storeInt(src.lastDepositId, 257);
  };
}

export function loadUserDeposits(slice: Slice) {
  let sc_0 = slice;
  let _totalDeposits = sc_0.loadIntBig(257);
  let _deposits = Dictionary.load(
    Dictionary.Keys.BigInt(257),
    dictValueParserDepositInfo(),
    sc_0
  );
  let _lastDepositId = sc_0.loadIntBig(257);
  return {
    $$type: "UserDeposits" as const,
    totalDeposits: _totalDeposits,
    deposits: _deposits,
    lastDepositId: _lastDepositId,
  };
}

function loadTupleUserDeposits(source: TupleReader) {
  let _totalDeposits = source.readBigNumber();
  let _deposits = Dictionary.loadDirect(
    Dictionary.Keys.BigInt(257),
    dictValueParserDepositInfo(),
    source.readCellOpt()
  );
  let _lastDepositId = source.readBigNumber();
  return {
    $$type: "UserDeposits" as const,
    totalDeposits: _totalDeposits,
    deposits: _deposits,
    lastDepositId: _lastDepositId,
  };
}

function storeTupleUserDeposits(source: UserDeposits) {
  let builder = new TupleBuilder();
  builder.writeNumber(source.totalDeposits);
  builder.writeCell(
    source.deposits.size > 0
      ? beginCell()
          .storeDictDirect(
            source.deposits,
            Dictionary.Keys.BigInt(257),
            dictValueParserDepositInfo()
          )
          .endCell()
      : null
  );
  builder.writeNumber(source.lastDepositId);
  return builder.build();
}

function dictValueParserUserDeposits(): DictionaryValue<UserDeposits> {
  return {
    serialize: (src, buidler) => {
      buidler.storeRef(beginCell().store(storeUserDeposits(src)).endCell());
    },
    parse: (src) => {
      return loadUserDeposits(src.loadRef().beginParse());
    },
  };
}

type SolviumMultiplier_init_args = {
  $$type: "SolviumMultiplier_init_args";
};

function initSolviumMultiplier_init_args(src: SolviumMultiplier_init_args) {
  return (builder: Builder) => {
    let b_0 = builder;
  };
}

async function SolviumMultiplier_init() {
  const __code = Cell.fromBase64(
    "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"
  );
  const __system = Cell.fromBase64(
    "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"
  );
  let builder = beginCell();
  builder.storeRef(__system);
  builder.storeUint(0, 1);
  initSolviumMultiplier_init_args({ $$type: "SolviumMultiplier_init_args" })(
    builder
  );
  const __data = builder.endCell();
  return { code: __code, data: __data };
}

const SolviumMultiplier_errors: { [key: number]: { message: string } } = {
  2: { message: `Stack undeflow` },
  3: { message: `Stack overflow` },
  4: { message: `Integer overflow` },
  5: { message: `Integer out of expected range` },
  6: { message: `Invalid opcode` },
  7: { message: `Type check error` },
  8: { message: `Cell overflow` },
  9: { message: `Cell underflow` },
  10: { message: `Dictionary error` },
  13: { message: `Out of gas error` },
  32: { message: `Method ID not found` },
  34: { message: `Action is invalid or not supported` },
  37: { message: `Not enough TON` },
  38: { message: `Not enough extra-currencies` },
  128: { message: `Null reference exception` },
  129: { message: `Invalid serialization prefix` },
  130: { message: `Invalid incoming message` },
  131: { message: `Constraints error` },
  132: { message: `Access denied` },
  133: { message: `Contract stopped` },
  134: { message: `Invalid argument` },
  135: { message: `Code of a contract was not found` },
  136: { message: `Invalid address` },
  137: { message: `Masterchain support is not enabled for this contract` },
  8415: { message: `Only owner can update multiplier factor` },
  12170: { message: `Insufficient reserve balance` },
  20975: { message: `Deposit amount too low` },
  26825: { message: `Only owner can withdraw` },
  43103: { message: `Invalid withdrawal amount` },
};

const SolviumMultiplier_types: ABIType[] = [
  {
    name: "StateInit",
    header: null,
    fields: [
      { name: "code", type: { kind: "simple", type: "cell", optional: false } },
      { name: "data", type: { kind: "simple", type: "cell", optional: false } },
    ],
  },
  {
    name: "Context",
    header: null,
    fields: [
      {
        name: "bounced",
        type: { kind: "simple", type: "bool", optional: false },
      },
      {
        name: "sender",
        type: { kind: "simple", type: "address", optional: false },
      },
      {
        name: "value",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      { name: "raw", type: { kind: "simple", type: "slice", optional: false } },
    ],
  },
  {
    name: "SendParameters",
    header: null,
    fields: [
      {
        name: "bounce",
        type: { kind: "simple", type: "bool", optional: false },
      },
      {
        name: "to",
        type: { kind: "simple", type: "address", optional: false },
      },
      {
        name: "value",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "mode",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      { name: "body", type: { kind: "simple", type: "cell", optional: true } },
      { name: "code", type: { kind: "simple", type: "cell", optional: true } },
      { name: "data", type: { kind: "simple", type: "cell", optional: true } },
    ],
  },
  {
    name: "Deploy",
    header: 2490013878,
    fields: [
      {
        name: "queryId",
        type: { kind: "simple", type: "uint", optional: false, format: 64 },
      },
    ],
  },
  {
    name: "DeployOk",
    header: 2952335191,
    fields: [
      {
        name: "queryId",
        type: { kind: "simple", type: "uint", optional: false, format: 64 },
      },
    ],
  },
  {
    name: "FactoryDeploy",
    header: 1829761339,
    fields: [
      {
        name: "queryId",
        type: { kind: "simple", type: "uint", optional: false, format: 64 },
      },
      {
        name: "cashback",
        type: { kind: "simple", type: "address", optional: false },
      },
    ],
  },
  {
    name: "ChangeOwner",
    header: 2174598809,
    fields: [
      {
        name: "queryId",
        type: { kind: "simple", type: "uint", optional: false, format: 64 },
      },
      {
        name: "newOwner",
        type: { kind: "simple", type: "address", optional: false },
      },
    ],
  },
  {
    name: "ChangeOwnerOk",
    header: 846932810,
    fields: [
      {
        name: "queryId",
        type: { kind: "simple", type: "uint", optional: false, format: 64 },
      },
      {
        name: "newOwner",
        type: { kind: "simple", type: "address", optional: false },
      },
    ],
  },
  {
    name: "UpdateMultiplierFactor",
    header: 1636919924,
    fields: [
      {
        name: "newFactor",
        type: { kind: "simple", type: "uint", optional: false, format: 32 },
      },
    ],
  },
  {
    name: "AdminWithdraw",
    header: 2288463416,
    fields: [
      {
        name: "amount",
        type: {
          kind: "simple",
          type: "uint",
          optional: false,
          format: "coins",
        },
      },
    ],
  },
  {
    name: "DepositInfo",
    header: null,
    fields: [
      {
        name: "id",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "amount",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "multiplier",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "startTime",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "active",
        type: { kind: "simple", type: "bool", optional: false },
      },
    ],
  },
  {
    name: "UserDeposits",
    header: null,
    fields: [
      {
        name: "totalDeposits",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
      {
        name: "deposits",
        type: {
          kind: "dict",
          key: "int",
          value: "DepositInfo",
          valueFormat: "ref",
        },
      },
      {
        name: "lastDepositId",
        type: { kind: "simple", type: "int", optional: false, format: 257 },
      },
    ],
  },
];

const SolviumMultiplier_getters: ABIGetter[] = [
  {
    name: "getAllUserDeposits",
    arguments: [
      {
        name: "user",
        type: { kind: "simple", type: "address", optional: false },
      },
    ],
    returnType: {
      kind: "dict",
      key: "int",
      value: "DepositInfo",
      valueFormat: "ref",
    },
  },
  {
    name: "getContractBalance",
    arguments: [],
    returnType: { kind: "simple", type: "int", optional: false, format: 257 },
  },
  {
    name: "getTotalDeposits",
    arguments: [],
    returnType: { kind: "simple", type: "int", optional: false, format: 257 },
  },
  {
    name: "getUserDepositSummary",
    arguments: [
      {
        name: "user",
        type: { kind: "simple", type: "address", optional: false },
      },
    ],
    returnType: { kind: "simple", type: "UserDeposits", optional: true },
  },
  {
    name: "owner",
    arguments: [],
    returnType: { kind: "simple", type: "address", optional: false },
  },
];

const SolviumMultiplier_receivers: ABIReceiver[] = [
  { receiver: "internal", message: { kind: "text", text: "Deposit" } },
  { receiver: "internal", message: { kind: "typed", type: "AdminWithdraw" } },
  {
    receiver: "internal",
    message: { kind: "typed", type: "UpdateMultiplierFactor" },
  },
  { receiver: "internal", message: { kind: "typed", type: "Deploy" } },
  { receiver: "internal", message: { kind: "typed", type: "ChangeOwner" } },
];

export class SolviumMultiplier implements Contract {
  static async init() {
    return await SolviumMultiplier_init();
  }

  static async fromInit() {
    const init = await SolviumMultiplier_init();
    const address = contractAddress(0, init);
    return new SolviumMultiplier(address, init);
  }

  static fromAddress(address: Address) {
    return new SolviumMultiplier(address);
  }

  readonly address: Address;
  readonly init?: { code: Cell; data: Cell };
  readonly abi: ContractABI = {
    types: SolviumMultiplier_types,
    getters: SolviumMultiplier_getters,
    receivers: SolviumMultiplier_receivers,
    errors: SolviumMultiplier_errors,
  };

  constructor(address: Address, init?: { code: Cell; data: Cell }) {
    this.address = address;
    this.init = init;
  }

  async send(
    provider: ContractProvider,
    via: Sender,
    args: { value: bigint; bounce?: boolean | null | undefined },
    message:
      | "Deposit"
      | AdminWithdraw
      | UpdateMultiplierFactor
      | Deploy
      | ChangeOwner
  ) {
    let body: Cell | null = null;
    if (message === "Deposit") {
      body = beginCell().storeUint(0, 32).storeStringTail(message).endCell();
    }
    if (
      message &&
      typeof message === "object" &&
      !(message instanceof Slice) &&
      message.$$type === "AdminWithdraw"
    ) {
      body = beginCell().store(storeAdminWithdraw(message)).endCell();
    }
    if (
      message &&
      typeof message === "object" &&
      !(message instanceof Slice) &&
      message.$$type === "UpdateMultiplierFactor"
    ) {
      body = beginCell().store(storeUpdateMultiplierFactor(message)).endCell();
    }
    if (
      message &&
      typeof message === "object" &&
      !(message instanceof Slice) &&
      message.$$type === "Deploy"
    ) {
      body = beginCell().store(storeDeploy(message)).endCell();
    }
    if (
      message &&
      typeof message === "object" &&
      !(message instanceof Slice) &&
      message.$$type === "ChangeOwner"
    ) {
      body = beginCell().store(storeChangeOwner(message)).endCell();
    }
    if (body === null) {
      throw new Error("Invalid message type");
    }

    await provider.internal(via, { ...args, body: body });
  }

  async getGetAllUserDeposits(provider: ContractProvider, user: Address) {
    let builder = new TupleBuilder();
    builder.writeAddress(user);
    let source = (await provider.get("getAllUserDeposits", builder.build()))
      .stack;
    let result = Dictionary.loadDirect(
      Dictionary.Keys.BigInt(257),
      dictValueParserDepositInfo(),
      source.readCellOpt()
    );
    return result;
  }

  async getGetContractBalance(provider: ContractProvider) {
    let builder = new TupleBuilder();
    let source = (await provider.get("getContractBalance", builder.build()))
      .stack;
    let result = source.readBigNumber();
    return result;
  }

  async getGetTotalDeposits(provider: ContractProvider) {
    let builder = new TupleBuilder();
    let source = (await provider.get("getTotalDeposits", builder.build()))
      .stack;
    let result = source.readBigNumber();
    return result;
  }

  async getGetUserDepositSummary(provider: ContractProvider, user: Address) {
    let builder = new TupleBuilder();
    builder.writeAddress(user);
    let source = (await provider.get("getUserDepositSummary", builder.build()))
      .stack;
    const result_p = source.readTupleOpt();
    const result = result_p ? loadTupleUserDeposits(result_p) : null;
    return result;
  }

  async getOwner(provider: ContractProvider) {
    let builder = new TupleBuilder();
    let source = (await provider.get("owner", builder.build())).stack;
    let result = source.readAddress();
    return result;
  }
}
