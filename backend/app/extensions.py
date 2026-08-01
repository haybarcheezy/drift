"""Shared Flask extensions.

Separated into their own module to avoid circular imports between the app
factory and the models.
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
