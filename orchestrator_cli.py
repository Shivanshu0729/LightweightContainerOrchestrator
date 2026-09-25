import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import yaml


def request(api_url: str, method: str, path: str, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = Request(f"{api_url.rstrip('/')}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"API {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Unable to reach orchestrator at {api_url}: {error.reason}") from error


def load_manifest(path: Path) -> dict:
    with path.open(encoding="utf-8") as manifest_file:
        manifest = yaml.safe_load(manifest_file)
    if not isinstance(manifest, dict) or manifest.get("kind") != "Pod":
        raise ValueError("Manifest kind must be 'Pod'.")
    metadata = manifest.get("metadata") or {}
    spec = manifest.get("spec") or {}
    containers = spec.get("containers") or []
    if not metadata.get("name"):
        raise ValueError("Manifest metadata.name is required.")
    if len(containers) != 1:
        raise ValueError("A Pod manifest must contain exactly one container.")
    container = containers[0]
    if not container.get("image"):
        raise ValueError("Manifest container.image is required.")
    return manifest


def container_payload(manifest: dict) -> dict:
    metadata = manifest["metadata"]
    spec = manifest["spec"]
    source = spec["containers"][0]
    ports = source.get("ports") or []
    port = ports[0].get("hostPort") if ports else None
    container_port = ports[0].get("containerPort") if ports else None
    env_vars = {
        entry["name"]: str(entry.get("value", ""))
        for entry in source.get("env", [])
        if entry.get("name")
    }
    probe = source.get("livenessProbe") or source.get("readinessProbe")
    health_check = None
    if probe and probe.get("httpGet"):
        health_check = {
            "type": "http",
            "path": probe["httpGet"].get("path", "/"),
            "timeout": max(1, int(probe.get("timeoutSeconds", 3))),
        }
    return {
        "name": metadata["name"],
        "image": source["image"],
        "port": port,
        "container_port": container_port,
        "env_vars": env_vars,
        "auto_restart": spec.get("restartPolicy", "Always") != "Never",
        "health_check": health_check,
    }


def apply_manifest(api_url: str, path: Path) -> dict:
    manifest = load_manifest(path)
    payload = container_payload(manifest)
    containers = request(api_url, "GET", "/api/containers")
    existing = next((item for item in containers if item["name"] == payload["name"]), None)
    if existing:
        if existing["image"] != payload["image"]:
            result = request(api_url, "POST", f"/api/containers/{existing['id']}/update", {"image": payload["image"]})
            result["action"] = "updated"
            return result
        existing["action"] = "unchanged"
        return existing
    result = request(api_url, "POST", "/api/containers", payload)
    result["action"] = "created"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy Pod manifests to the Lightweight Container Orchestrator")
    parser.add_argument("--api-url", default="http://127.0.0.1:8088")
    subparsers = parser.add_subparsers(dest="command", required=True)

    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("manifest", type=Path)
    subparsers.add_parser("get")
    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("name")

    args = parser.parse_args()
    try:
        if args.command == "apply":
            result = apply_manifest(args.api_url, args.manifest)
        elif args.command == "get":
            result = request(args.api_url, "GET", "/api/containers")
        else:
            containers = request(args.api_url, "GET", "/api/containers")
            target = next((item for item in containers if item["name"] == args.name), None)
            if not target:
                raise RuntimeError(f"Container '{args.name}' is not registered.")
            request(args.api_url, "DELETE", f"/api/containers/{target['id']}")
            result = {"action": "deleted", "name": args.name}
        print(json.dumps(result, indent=2, default=str))
        return 0
    except (OSError, RuntimeError, ValueError, KeyError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())