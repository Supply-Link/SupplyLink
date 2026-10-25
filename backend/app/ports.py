"""Application ports. Replace LocalOperations with a gRPC adapter after extraction."""
from typing import Protocol

from app.domain import mutate, register, snapshot


class BusinessOperations(Protocol):
    def snapshot(self, data, user): ...
    def register(self, data, body): ...
    def mutate(self, data, user, path, body, key): ...


class LocalOperations:
    """Current in-process implementation of the business-command port."""
    @staticmethod
    def snapshot(data, user):
        return snapshot(data, user)

    @staticmethod
    def register(data, body):
        return register(data, body)

    @staticmethod
    def mutate(data, user, path, body, key):
        return mutate(data, user, path, body, key)
