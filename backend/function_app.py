"""
Azure Functions entry point for Steel Agent backend.
Wraps the FastAPI app for Azure Functions deployment.
"""
import azure.functions as func
import sys
import os

# Ensure local imports work when deployed to Azure Functions
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import app

# Create the Azure Functions app from FastAPI
main = func.AsgiFunctionApp(app=app, http_auth_level=func.AuthLevel.ANONYMOUS)
