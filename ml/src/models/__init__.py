"""Trainable model wrappers for the REXA ML modules."""

from .classifiers import (  # noqa: F401
    ConceptCoverageModel,
    DepthRegressor,
    SklearnRoleClassifier,
    StarRegressor,
    SupportClassifier,
)

# DistilBERT helpers are optional (require torch/transformers)
try:
    from .distilbert_stars import DistilBertStarPredictor, train_distilbert_stars  # noqa: F401
except ImportError:
    pass
