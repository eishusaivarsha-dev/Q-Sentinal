# Integration Contract with Backend / Blockchain / Frontend

The quantum workstream exposes serializable Python dataclasses. The backend can
convert them into JSON for the REST/WebSocket layer, while the blockchain team
can hash the verification transcript before ledger anchoring.

## D3 verification result

```json
{
  "accepted": true,
  "message_digest": "...",
  "verifier_id": "verifier-01",
  "nonce": "...",
  "observed": [0, 1, 0],
  "expected": [0, 1, 0],
  "bases": ["Z", "X", "Y"],
  "mismatches": 0,
  "rounds": 3,
  "basis_commitment_ok": true,
  "message_binding_ok": true,
  "pair_provenance_ok": true,
  "identity_ok": true,
  "nonce_fresh": true,
  "transcript": {}
}
```

## D4 detection result

Every detector returns a stable result:

```json
{
  "name": "D4_channel_anomaly_detector",
  "detected": true,
  "score": 0.25,
  "threshold": 0.12,
  "details": {}
}
```

The frontend only needs these stable result objects for an alert feed. The
backend can persist the full transcript. The blockchain team can commit its
hash together with the nonce and verdict without importing any detector model.
