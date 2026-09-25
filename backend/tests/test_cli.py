from pathlib import Path

from orchestrator_cli import container_payload, load_manifest


def test_demo_pod_manifest_maps_to_container_request():
    manifest = load_manifest(Path("manifests/demo-pod.yaml"))

    assert manifest["kind"] == "Pod"
    assert container_payload(manifest) == {
        "name": "demo-nginx",
        "image": "nginx:alpine",
        "port": 8089,
        "container_port": 80,
        "env_vars": {},
        "auto_restart": True,
        "health_check": {
            "type": "http",
            "path": "/",
            "timeout": 3,
        },
    }
