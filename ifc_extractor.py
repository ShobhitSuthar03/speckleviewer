#!/usr/bin/env python3
"""
IFC Type Extractor - Clean and Factored Version
Extracts all IFC types and their GlobalIds from Speckle model URLs.

Usage:
    python ifc_extractor.py <speckle_url>
    
Example:
    python ifc_extractor.py https://app.speckle.systems/projects/080aa54b8c/models/672e2108a2
"""

import sys
import re
import os
import requests
from dotenv import load_dotenv
from specklepy.api.client import SpeckleClient
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import receive
from specklepy.objects.base import Base

# Load environment variables
load_dotenv()


class IFCExtractor:
    """Main class for extracting IFC data from Speckle."""
    
    def __init__(self, url, token=None):
        """Initialize the IFC extractor with URL and token."""
        self.url = url
        self.token = token or os.getenv('SPECKLE_TOKEN')
        self.client = None
        self.received_data = None
        
    def parse_url(self):
        """Parse Speckle URL and return (server, project_id, model_id)."""
        url = self.url.rstrip('/')
        server = re.match(r'(https?://[^/]+)', url).group(1)
        
        # New format: /projects/{id}/models/{id}
        if match := re.search(r'/projects/([a-f0-9]+)/models/([a-f0-9]+)', url):
            return server, match.group(1), match.group(2)
        
        # Legacy format: /streams/{id}
        if match := re.search(r'/streams/([a-f0-9]+)', url):
            return server, None, match.group(1)
        
        raise ValueError("Unsupported URL format")
    
    def authenticate(self):
        """Authenticate with Speckle server."""
        if not self.token:
            raise ValueError("No authentication token provided. Set SPECKLE_TOKEN in .env file")
        
        server, project_id, model_id = self.parse_url()
        self.client = SpeckleClient(host=server)
        self.client.authenticate_with_token(self.token)
        
        return server, project_id, model_id
    
    def get_commit_id_from_preview_url(self, model_data):
        """Extract commit ID from model's preview URL."""
        preview_url = getattr(model_data, 'preview_url', '')
        if preview_url:
            commit_match = re.search(r'/commits/([a-f0-9]+)', preview_url)
            if commit_match:
                return commit_match.group(1)
        return None
    
    def get_object_id_from_commit(self, stream_id, commit_id):
        """Get object ID from commit using HTTP request."""
        url = f"https://app.speckle.systems/graphql"
        query = f"""
        {{
            stream(id: "{stream_id}") {{
                commit(id: "{commit_id}") {{
                    referencedObject
                }}
            }}
        }}
        """
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        payload = {"query": query}
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and data['data'] and 'stream' in data['data']:
                stream_data = data['data']['stream']
                if stream_data and 'commit' in stream_data and stream_data['commit']:
                    commit_data = stream_data['commit']
                    return commit_data['referencedObject']
        
        return None
    
    def receive_data(self):
        """Receive and deserialize data from Speckle stream."""
        server, project_id, model_id = self.parse_url()
        
        # Create transport (use project_id as stream_id)
        stream_id = project_id if project_id else model_id
        transport = ServerTransport(client=self.client, stream_id=stream_id)
        
        if project_id:
            # New format: get model info first
            project = self.client.project.get_with_models(project_id)
            
            # Find target model
            target_model = None
            if hasattr(project, 'models') and project.models:
                models = list(project.models)
                for model in models:
                    if isinstance(model, tuple) and len(model) == 2:
                        key, value = model
                        if key == 'items' and isinstance(value, list):
                            for m in value:
                                if getattr(m, 'id', '') == model_id:
                                    target_model = m
                                    break
                            break
            
            if target_model:
                commit_id = self.get_commit_id_from_preview_url(target_model)
                if commit_id:
                    object_id = self.get_object_id_from_commit(stream_id, commit_id)
                    if object_id:
                        self.received_data = receive(obj_id=object_id, remote_transport=transport)
                        return True
        
        return False
    
    def extract_ifc_types(self, data, ifc_types=None, max_depth=10, current_depth=0):
        """Recursively extract all IFC types from the data."""
        if ifc_types is None:
            ifc_types = {}
        
        if current_depth > max_depth:
            return ifc_types
        
        if hasattr(data, '__dict__'):
            # Check if this is an IFC object
            if hasattr(data, 'speckle_type') and data.speckle_type:
                ifc_type = data.speckle_type
                
                # Skip geometry meshes
                if ifc_type != 'Objects.Geometry.Mesh':
                    if ifc_type not in ifc_types:
                        ifc_types[ifc_type] = {
                            'count': 0,
                            'instances': []
                        }
                    
                    ifc_types[ifc_type]['count'] += 1
                    
                    # Store instance info
                    instance_info = {
                        'GlobalId': getattr(data, 'GlobalId', 'Unknown'),
                        'Name': getattr(data, 'Name', 'Unknown'),
                        'ObjectType': getattr(data, 'ObjectType', 'Unknown'),
                        'Tag': getattr(data, 'Tag', 'Unknown')
                    }
                    ifc_types[ifc_type]['instances'].append(instance_info)
            
            # Recursively analyze elements
            if hasattr(data, 'elements') and data.elements:
                for element in data.elements:
                    self.extract_ifc_types(element, ifc_types, max_depth, current_depth + 1)
            
            # Check other potential collections
            for attr_name, attr_value in data.__dict__.items():
                if not attr_name.startswith('_') and isinstance(attr_value, list):
                    for item in attr_value:
                        if hasattr(item, '__dict__'):
                            self.extract_ifc_types(item, ifc_types, max_depth, current_depth + 1)
        
        return ifc_types
    
    def run(self):
        """Main execution method."""
        try:
            print(f"🔍 Extracting IFC types from: {self.url}")
            
            # Authenticate
            server, project_id, model_id = self.authenticate()
            print(f"✅ Authenticated with {server}")
            
            # Receive data
            if self.receive_data():
                print(f"✅ Successfully received data")
                
                # Extract IFC types
                ifc_types = self.extract_ifc_types(self.received_data)
                
                if ifc_types:
                    self.display_results(ifc_types)
                    return ifc_types
                else:
                    print("❌ No IFC types found")
                    return None
            else:
                print("❌ Failed to receive data")
                return None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def display_results(self, ifc_types):
        """Display the extracted IFC types in a formatted way."""
        print(f"\n📋 IFC Types Found ({len(ifc_types)} total):")
        print("=" * 80)
        
        # Sort by count (most common first)
        sorted_types = sorted(ifc_types.items(), key=lambda x: x[1]['count'], reverse=True)
        
        for i, (ifc_type, info) in enumerate(sorted_types, 1):
            print(f"\n{i:2d}. {ifc_type}")
            print(f"    Count: {info['count']}")
            
            # Show first 5 instances with GlobalIds
            print(f"    Sample GlobalIds:")
            for j, instance in enumerate(info['instances'][:5]):
                print(f"       {j+1}. {instance['GlobalId']} - {instance['Name']} ({instance['ObjectType']})")
            
            if len(info['instances']) > 5:
                print(f"       ... and {len(info['instances']) - 5} more instances")
        
        # Summary
        total_instances = sum(info['count'] for info in ifc_types.values())
        print(f"\n📊 Summary:")
        print(f"   Total IFC Types: {len(ifc_types)}")
        print(f"   Total Instances: {total_instances}")
    
    def export_to_csv(self, ifc_types, filename="ifc_types.csv"):
        """Export IFC types to CSV file."""
        import csv
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['IFC_Type', 'GlobalId', 'Name', 'ObjectType', 'Tag'])
            
            for ifc_type, info in ifc_types.items():
                for instance in info['instances']:
                    writer.writerow([
                        ifc_type,
                        instance['GlobalId'],
                        instance['Name'],
                        instance['ObjectType'],
                        instance['Tag']
                    ])
        
        print(f"📄 Exported to {filename}")


def main():
    """Main entry point."""
    if len(sys.argv) != 2:
        print("Usage: python ifc_extractor.py <speckle_url>")
        print("Example: python ifc_extractor.py https://app.speckle.systems/projects/080aa54b8c/models/672e2108a2")
        print("\n💡 Make sure to set SPECKLE_TOKEN in your .env file")
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Create extractor and run
    extractor = IFCExtractor(url)
    ifc_types = extractor.run()
    
    if ifc_types:
        # Ask user if they want to export to CSV
        export = input("\n📄 Export to CSV? (y/n): ").lower().strip()
        if export == 'y':
            extractor.export_to_csv(ifc_types)
        
        print(f"\n🎉 Extraction completed successfully!")
    else:
        print(f"\n💥 Extraction failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
