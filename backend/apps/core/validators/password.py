import re
from django.core.exceptions import ValidationError

class EnterprisePasswordValidator:
    MIN_LENGTH = 12
    def validate(self, password, user=None):
        errors = []
        if len(password) < self.MIN_LENGTH: errors.append(f'Mínimo {self.MIN_LENGTH} caracteres.')
        if not re.search(r'[A-Z]', password): errors.append('Debe incluir mayúscula.')
        if not re.search(r'[a-z]', password): errors.append('Debe incluir minúscula.')
        if not re.search(r'\d', password):    errors.append('Debe incluir número.')
        if not re.search(r'[^A-Za-z0-9]', password): errors.append('Debe incluir símbolo.')
        if errors: raise ValidationError(errors)
    def get_help_text(self): return 'Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.'
