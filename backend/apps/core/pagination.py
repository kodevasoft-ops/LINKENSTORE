from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
class StandardPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100
    def get_paginated_response(self, data):
        return Response({'count': self.page.paginator.count, 'pages': self.page.paginator.num_pages, 'page': self.page.number, 'next': self.get_next_link(), 'previous': self.get_previous_link(), 'results': data})
