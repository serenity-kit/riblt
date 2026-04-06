#!/usr/bin/env python3

import base64
import json
import math
import struct
import sys
from dataclasses import dataclass
from heapq import heappop, heappush
from pathlib import Path
from typing import Optional

try:
    import xxhash
except ImportError as error:
    raise SystemExit(
        "Missing dependency: xxhash. Install with `python3 -m pip install -r interop/requirements.txt`."
    ) from error

VERSION = 1
HASH_ID = "xxh3-128"
LENGTH_BYTES = 4
MAX_SYMBOL_SIZE = 4096
MAX_CODED_SYMBOLS = 65536
MASK_64 = (1 << 64) - 1
MASK_128 = (1 << 128) - 1
UINT32_FLOAT = 2 ** 32
RANDOM_MAPPING_MULTIPLIER = 0xDA942042E4DD58B5


def hash_symbol(symbol: bytes, seed: int) -> int:
    return xxhash.xxh3_128_intdigest(symbol, seed=seed & MASK_64) & MASK_128


def seed_from_hash(value: int) -> int:
    return value & MASK_64


def hash_to_hex(value: int) -> str:
    return f"{value & MASK_128:032x}"


def seed_to_hex(value: int) -> str:
    return f"{value & MASK_64:016x}"


def hash_to_bytes_le(value: int) -> bytes:
    low = value & MASK_64
    high = (value >> 64) & MASK_64
    return struct.pack("<QQ", low, high)


def hash_from_bytes_le(value: bytes) -> int:
    low, high = struct.unpack("<QQ", value)
    return (high << 64) | low


def encode_string_symbol(value: str, symbol_size: int) -> bytes:
    encoded = value.encode("utf-8")
    if len(encoded) > symbol_size - LENGTH_BYTES:
        raise ValueError("symbolSize too small for id")
    return struct.pack("<I", len(encoded)) + encoded + bytes(symbol_size - LENGTH_BYTES - len(encoded))


def decode_string_symbol(symbol: bytes) -> str:
    if len(symbol) < LENGTH_BYTES:
        raise ValueError("symbol too small to decode")
    length = struct.unpack("<I", symbol[:LENGTH_BYTES])[0]
    if length > len(symbol) - LENGTH_BYTES:
        raise ValueError("invalid symbol length prefix")
    return symbol[LENGTH_BYTES:LENGTH_BYTES + length].decode("utf-8")


@dataclass
class HashedSymbol:
    symbol: bytes
    hash: int


@dataclass
class CodedSymbol:
    symbol: bytearray
    hash: int
    count: int


class RandomMapping:
    def __init__(self, seed: int, last_index: int) -> None:
        self.prng = seed & MASK_64
        self.last_index = last_index

    def next_index(self) -> int:
        self.prng = (self.prng * RANDOM_MAPPING_MULTIPLIER) & MASK_64
        prng_float = float(self.prng)
        diff = math.ceil((self.last_index + 1.5) * (UINT32_FLOAT / math.sqrt(prng_float + 1.0) - 1.0))
        self.last_index += diff
        return self.last_index


class CodingWindow:
    def __init__(self) -> None:
        self.symbols: list[HashedSymbol] = []
        self.mappings: list[RandomMapping] = []
        self.queue: list[tuple[int, int]] = []
        self.next_idx = 0

    def add_hashed_symbol(self, symbol: HashedSymbol) -> None:
        self.add_hashed_symbol_with_mapping(symbol, RandomMapping(seed_from_hash(symbol.hash), 0))

    def add_hashed_symbol_with_mapping(self, symbol: HashedSymbol, mapping: RandomMapping) -> None:
        source_idx = len(self.symbols)
        self.symbols.append(symbol)
        self.mappings.append(mapping)
        heappush(self.queue, (mapping.last_index, source_idx))

    def apply_window(self, coded: CodedSymbol, direction: int) -> CodedSymbol:
        if not self.queue:
            self.next_idx += 1
            return coded

        while self.queue and self.queue[0][0] == self.next_idx:
            _, source_idx = heappop(self.queue)
            coded = apply_symbol(coded, self.symbols[source_idx], direction)
            next_idx = self.mappings[source_idx].next_index()
            heappush(self.queue, (next_idx, source_idx))

        self.next_idx += 1
        return coded

    def reset(self) -> None:
        self.symbols.clear()
        self.mappings.clear()
        self.queue.clear()
        self.next_idx = 0


class Encoder:
    def __init__(self, symbol_size: int) -> None:
        self.window = CodingWindow()
        self.symbol_size = symbol_size

    def add_hashed_symbol(self, symbol: HashedSymbol) -> None:
        self.window.add_hashed_symbol(symbol)

    def produce_next_coded_symbol(self) -> CodedSymbol:
        return self.window.apply_window(create_empty_coded_symbol(self.symbol_size), 1)

    def reset(self) -> None:
        self.window.reset()


class Decoder:
    def __init__(self, symbol_size: int, hash_seed: int) -> None:
        self.cs: list[CodedSymbol] = []
        self.local = CodingWindow()
        self.window = CodingWindow()
        self.remote = CodingWindow()
        self.decodable: list[int] = []
        self.decoded = 0
        self.hash_seed = hash_seed

    def decoded_all(self) -> bool:
        return self.decoded == len(self.cs)

    def add_hashed_symbol(self, symbol: HashedSymbol) -> None:
        self.window.add_hashed_symbol(symbol)

    def add_coded_symbol(self, coded: CodedSymbol) -> None:
        current = self.window.apply_window(coded, -1)
        current = self.remote.apply_window(current, -1)
        current = self.local.apply_window(current, 1)
        self.cs.append(current)
        idx = len(self.cs) - 1
        if ((current.count == 1 or current.count == -1) and current.hash == hash_symbol(bytes(current.symbol), self.hash_seed)) or (
            current.count == 0 and current.hash == 0
        ):
            self.decodable.append(idx)

    def try_decode(self) -> None:
        idx = 0
        while idx < len(self.decodable):
            coded_idx = self.decodable[idx]
            coded = self.cs[coded_idx]
            if coded.count == 1:
                symbol = HashedSymbol(bytes(coded.symbol), coded.hash)
                mapping = self.apply_new_symbol(symbol, -1)
                self.remote.add_hashed_symbol_with_mapping(symbol, mapping)
                self.decoded += 1
            elif coded.count == -1:
                symbol = HashedSymbol(bytes(coded.symbol), coded.hash)
                mapping = self.apply_new_symbol(symbol, 1)
                self.local.add_hashed_symbol_with_mapping(symbol, mapping)
                self.decoded += 1
            elif coded.count == 0:
                self.decoded += 1
            else:
                raise ValueError("invalid degree for decodable coded symbol")
            idx += 1
        self.decodable.clear()

    def reset(self) -> None:
        self.cs.clear()
        self.decodable.clear()
        self.local.reset()
        self.remote.reset()
        self.window.reset()
        self.decoded = 0

    def apply_new_symbol(self, symbol: HashedSymbol, direction: int) -> RandomMapping:
        mapping = RandomMapping(seed_from_hash(symbol.hash), 0)
        while mapping.last_index < len(self.cs):
            coded_idx = mapping.last_index
            self.cs[coded_idx] = apply_symbol(self.cs[coded_idx], symbol, direction)
            current = self.cs[coded_idx]
            if (current.count == 1 or current.count == -1) and current.hash == hash_symbol(bytes(current.symbol), self.hash_seed):
                self.decodable.append(coded_idx)
            mapping.next_index()
        return mapping


def create_empty_coded_symbol(symbol_size: int) -> CodedSymbol:
    return CodedSymbol(bytearray(symbol_size), 0, 0)


def apply_symbol(coded: CodedSymbol, symbol: HashedSymbol, direction: int) -> CodedSymbol:
    for index, value in enumerate(symbol.symbol):
        coded.symbol[index] ^= value
    coded.hash ^= symbol.hash
    coded.count += direction
    return coded


class RibltSession:
    def __init__(self, symbol_size: int, batch_size: int, hash_seed: int) -> None:
        if symbol_size <= LENGTH_BYTES or symbol_size > MAX_SYMBOL_SIZE:
            raise ValueError("invalid symbol size")
        if batch_size <= 0 or batch_size > MAX_CODED_SYMBOLS:
            raise ValueError("invalid batch size")
        self.symbol_size = symbol_size
        self.batch_size = batch_size
        self.hash_seed = hash_seed & MASK_64
        self.encoder = Encoder(symbol_size)
        self.decoder = Decoder(symbol_size, self.hash_seed)
        self.started = False
        self.failed = False
        self.received = 0

    def add(self, ids: list[str]) -> None:
        if self.started:
            raise ValueError("cannot add symbols after encoding or merging has started")
        for value in ids:
            symbol = encode_string_symbol(value, self.symbol_size)
            hashed = HashedSymbol(symbol, hash_symbol(symbol, self.hash_seed))
            self.encoder.add_hashed_symbol(hashed)
            self.decoder.add_hashed_symbol(hashed)

    def encode_binary(self, count: Optional[int] = None) -> bytes:
        self.started = True
        total = count or self.batch_size
        if total <= 0 or total > MAX_CODED_SYMBOLS:
            raise ValueError("invalid count")
        coded_symbols = [self.encoder.produce_next_coded_symbol() for _ in range(total)]
        return encode_message_binary(self.symbol_size, self.hash_seed, coded_symbols)

    def encode_object(self, count: Optional[int] = None) -> dict:
        self.started = True
        total = count or self.batch_size
        if total <= 0 or total > MAX_CODED_SYMBOLS:
            raise ValueError("invalid count")
        coded_symbols = [self.encoder.produce_next_coded_symbol() for _ in range(total)]
        return encode_message_object(self.symbol_size, self.hash_seed, coded_symbols)

    def merge_binary(self, message: bytes) -> None:
        self.started = True
        decoded = decode_message_binary(message)
        if decoded["symbolSize"] != self.symbol_size:
            self.failed = True
            raise ValueError("symbolSize mismatch between peers")
        if decoded["seed"] != self.hash_seed:
            self.failed = True
            raise ValueError("hash seed mismatch between peers")
        for coded in decoded["codedSymbols"]:
            self.decoder.add_coded_symbol(coded)
        self.received += len(decoded["codedSymbols"])

    def decode(self) -> dict:
        if self.failed:
            return {"status": "failed", "missing": [], "extra": []}
        if self.received == 0:
            return {"status": "incomplete", "missing": [], "extra": []}
        self.decoder.try_decode()
        missing = sorted(decode_string_symbol(symbol.symbol) for symbol in self.decoder.remote.symbols)
        extra = sorted(decode_string_symbol(symbol.symbol) for symbol in self.decoder.local.symbols)
        status = "complete" if self.decoder.decoded_all() else "incomplete"
        return {"status": status, "missing": missing, "extra": extra}


def encode_message_binary(symbol_size: int, seed: int, coded_symbols: list[CodedSymbol]) -> bytes:
    header = bytearray(16)
    header[0] = VERSION
    struct.pack_into("<H", header, 2, symbol_size)
    struct.pack_into("<I", header, 4, len(coded_symbols))
    struct.pack_into("<Q", header, 8, seed & MASK_64)
    body = bytearray()
    for coded in coded_symbols:
        body.extend(struct.pack("<i", coded.count))
        body.extend(hash_to_bytes_le(coded.hash))
        body.extend(coded.symbol)
    return bytes(header + body)


def encode_message_object(symbol_size: int, seed: int, coded_symbols: list[CodedSymbol]) -> dict:
    return {
        "v": VERSION,
        "hash": HASH_ID,
        "symbolSize": symbol_size,
        "seed": seed_to_hex(seed),
        "coded": [
            {
                "count": coded.count,
                "hash": hash_to_hex(coded.hash),
                "symbol": base64.b64encode(bytes(coded.symbol)).decode("ascii"),
            }
            for coded in coded_symbols
        ],
    }


def decode_message_binary(message: bytes) -> dict:
    if len(message) < 16:
        raise ValueError("message too short")
    version = message[0]
    if version != VERSION:
        raise ValueError("unsupported message version")
    symbol_size = struct.unpack_from("<H", message, 2)[0]
    if symbol_size <= LENGTH_BYTES or symbol_size > MAX_SYMBOL_SIZE:
        raise ValueError("invalid symbol size")
    count = struct.unpack_from("<I", message, 4)[0]
    if count > MAX_CODED_SYMBOLS:
        raise ValueError("invalid coded symbol count")
    seed = struct.unpack_from("<Q", message, 8)[0]
    coded_size = 4 + 16 + symbol_size
    expected_length = 16 + count * coded_size
    if len(message) != expected_length:
        raise ValueError("invalid message length")

    coded_symbols: list[CodedSymbol] = []
    offset = 16
    for _ in range(count):
        symbol_count = struct.unpack_from("<i", message, offset)[0]
        offset += 4
        symbol_hash = hash_from_bytes_le(message[offset:offset + 16])
        offset += 16
        symbol = bytearray(message[offset:offset + symbol_size])
        offset += symbol_size
        coded_symbols.append(CodedSymbol(symbol, symbol_hash, symbol_count))

    return {
        "symbolSize": symbol_size,
        "seed": seed,
        "codedSymbols": coded_symbols,
    }


def verify_fixture(fixture_path: Path) -> None:
    fixture = json.loads(fixture_path.read_text())
    frame_case = next(case for case in fixture["cases"] if case["name"] == "object-and-binary-frame")
    reconcile_case = next(case for case in fixture["cases"] if case["name"] == "streamed-reconciliation")

    options = frame_case["options"]
    session = RibltSession(options["symbolSize"], options["batchSize"], int(options["hashSeed"], 16))
    session.add(frame_case["ids"])
    binary_hex = session.encode_binary(frame_case["count"]).hex()
    if binary_hex != frame_case["binaryHex"]:
        raise AssertionError("binary fixture mismatch")

    session = RibltSession(options["symbolSize"], options["batchSize"], int(options["hashSeed"], 16))
    session.add(frame_case["ids"])
    object_frame = session.encode_object(frame_case["count"])
    if object_frame != frame_case["objectFrame"]:
        raise AssertionError("object fixture mismatch")

    reconcile_options = reconcile_case["options"]
    alice = RibltSession(
        reconcile_options["symbolSize"],
        reconcile_options["batchSize"],
        int(reconcile_options["hashSeed"], 16),
    )
    bob = RibltSession(
        reconcile_options["symbolSize"],
        reconcile_options["batchSize"],
        int(reconcile_options["hashSeed"], 16),
    )
    alice.add(reconcile_case["aliceIds"])
    bob.add(reconcile_case["bobIds"])

    frames_hex: list[str] = []
    rounds = 0
    result = bob.decode()
    while result["status"] != "complete" and rounds < reconcile_case["rounds"] + 2:
        frame = alice.encode_binary(reconcile_case["count"])
        frames_hex.append(frame.hex())
        bob.merge_binary(frame)
        result = bob.decode()
        rounds += 1

    if frames_hex != reconcile_case["framesHex"]:
        raise AssertionError("reconciliation frame sequence mismatch")
    if rounds != reconcile_case["rounds"]:
        raise AssertionError("reconciliation round count mismatch")
    if result != reconcile_case["result"]:
        raise AssertionError("reconciliation result mismatch")


def main() -> int:
    fixture_path = Path(__file__).resolve().parents[1] / "packages" / "riblt" / "test" / "fixtures" / "interop-v1.json"
    verify_fixture(fixture_path)
    print(f"Verified {fixture_path} with the Python compatibility harness.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
